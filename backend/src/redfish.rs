use anyhow::{Context, Result};
use base64::Engine;
use reqwest::{header, Client, StatusCode};
use serde_json::{json, Value};
use crate::cache::*;

#[derive(Clone)]
pub struct RedfishSession {
    pub client: Client,
    pub token: String,
    pub chassis_url: String,
    pub thermal_url: String,
    pub power_url: String,
    pub system_path: String,
}

pub async fn create_session(bmc_ip: &str, username: &str, password: &str) -> Result<RedfishSession> {
    let base_url = format!("https://{}/redfish/v1", bmc_ip);
    let client = Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .context("构建 HTTP 客户端失败")?;

    let login_url = format!("{}/SessionService/Sessions", base_url);
    let auth_str = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", username, password))
    );
    let login_body = json!({"UserName": username, "Password": password});

    let resp = client
        .post(&login_url)
        .header(header::AUTHORIZATION, auth_str)
        .json(&login_body)
        .send()
        .await
        .context("登录请求失败")?;

    if resp.status() != StatusCode::CREATED {
        anyhow::bail!("登录失败: {}", resp.status());
    }

    let token = resp
        .headers()
        .get("X-Auth-Token")
        .and_then(|v| v.to_str().ok())
        .context("未获取到 Token")?
        .to_string();

    let chassis_root: Value = client
        .get(format!("{}/Chassis", base_url))
        .header("X-Auth-Token", &token)
        .send()
        .await?
        .json()
        .await?;

    let chassis_path = chassis_root
        .get("Members")
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.first())
        .and_then(|m| m.get("@odata.id"))
        .and_then(|v| v.as_str())
        .context("未找到 Chassis 路径")?;

    let full_chassis_url = format!("https://{}{}", bmc_ip, chassis_path);
    let thermal_url = format!("{}/Thermal", full_chassis_url);
    let power_url = format!("{}/Power", full_chassis_url);

    let systems_root: Value = client
        .get(format!("{}/Systems", base_url))
        .header("X-Auth-Token", &token)
        .send()
        .await?
        .json()
        .await?;

    let system_path = systems_root
        .get("Members")
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.first())
        .and_then(|m| m.get("@odata.id"))
        .and_then(|v| v.as_str())
        .context("未找到 System 路径")?
        .to_string();

    Ok(RedfishSession {
        client,
        token,
        chassis_url: full_chassis_url,
        thermal_url,
        power_url,
        system_path,
    })
}

pub async fn poll_thermal(session: &RedfishSession) -> Result<(Vec<SensorReading>, Vec<SensorReading>)> {
    let body: Value = session.client
        .get(&session.thermal_url)
        .header("X-Auth-Token", &session.token)
        .send()
        .await?
        .json()
        .await?;

    let mut temperatures = vec![];
    let mut fans = vec![];

    if let Some(temps) = body.get("Temperatures").and_then(|v| v.as_array()) {
        for item in temps {
            let name = item.get("Name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let health = item.get("Status").and_then(|s| s.get("Health")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let state = item.get("Status").and_then(|s| s.get("State")).and_then(|v| v.as_str()).map(|s| s.to_string());

            if state.as_deref() == Some("Absent") {
                continue;
            }

            let value = item.get("ReadingCelsius")
                .or_else(|| item.get("Reading"))
                .and_then(|v| v.as_f64());

            temperatures.push(SensorReading {
                name,
                value,
                units: Some("°C".to_string()),
                health,
                state,
            });
        }
    }

    if let Some(fan_list) = body.get("Fans").and_then(|v| v.as_array()) {
        for item in fan_list {
            let name = item.get("Name").or_else(|| item.get("FanName"))
                .and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let health = item.get("Status").and_then(|s| s.get("Health")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let state = item.get("Status").and_then(|s| s.get("State")).and_then(|v| v.as_str()).map(|s| s.to_string());

            if state.as_deref() == Some("Absent") {
                continue;
            }

            let value = item.get("Reading").and_then(|v| v.as_f64());
            let units = item.get("ReadingUnits").and_then(|v| v.as_str()).unwrap_or("RPM").to_string();

            fans.push(SensorReading { name, value, units: Some(units), health, state });
        }
    }

    Ok((temperatures, fans))
}

pub async fn poll_power(session: &RedfishSession) -> Result<(Vec<SensorReading>, Vec<PowerControlCache>, Vec<PSUInfo>)> {
    let body: Value = session.client
        .get(&session.power_url)
        .header("X-Auth-Token", &session.token)
        .send()
        .await?
        .json()
        .await?;

    let mut voltages = vec![];
    let mut power_controls = vec![];
    let mut power_supplies = vec![];

    if let Some(volt_arr) = body.get("Voltages").and_then(|v| v.as_array()) {
        for v in volt_arr {
            let name = v.get("Name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let health = v.get("Status").and_then(|s| s.get("Health")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let state = v.get("Status").and_then(|s| s.get("State")).and_then(|v| v.as_str()).map(|s| s.to_string());

            if state.as_deref() == Some("Absent") || state.as_deref() == Some("disabled") {
                continue;
            }

            let reading_volts = v.get("ReadingVolts").and_then(|v| v.as_f64());
            let reading_amps = v.get("ReadingAmps").and_then(|v| v.as_f64());
            let units_str = v.get("ReadingUnits").and_then(|u| u.as_str()).unwrap_or("");

            if reading_amps.is_some() || units_str.contains("Amp") || name.to_uppercase().contains("IOUT") {
                voltages.push(SensorReading {
                    name,
                    value: reading_amps,
                    units: Some("A".to_string()),
                    health,
                    state,
                });
            } else if reading_volts.is_some() {
                voltages.push(SensorReading {
                    name,
                    value: reading_volts,
                    units: Some("V".to_string()),
                    health,
                    state,
                });
            }
        }
    }

    if let Some(pc_list) = body.get("PowerControl").and_then(|v| v.as_array()) {
        for pc in pc_list {
            let name = pc.get("Name").and_then(|v| v.as_str()).unwrap_or("PowerControl").to_string();
            let power_consumed = pc.get("PowerConsumedWatts").and_then(|v| v.as_f64());
            let health = pc.get("Status").and_then(|s| s.get("Health")).and_then(|v| v.as_str()).unwrap_or("N/A").to_string();
            let state = pc.get("Status").and_then(|s| s.get("State")).and_then(|v| v.as_str()).unwrap_or("N/A").to_string();

            power_controls.push(PowerControlCache { name, power_consumed_watts: power_consumed, health, state });
        }
    }

    if let Some(ps_list) = body.get("PowerSupplies").and_then(|v| v.as_array()) {
        for ps in ps_list {
            let name = ps.get("Name").and_then(|v| v.as_str()).unwrap_or("PSU").to_string();
            let model = ps.get("Model").and_then(|v| v.as_str()).unwrap_or("-").to_string();
            let serial_number = ps.get("SerialNumber").and_then(|v| v.as_str()).unwrap_or("-").to_string();
            let last_output = ps.get("LastPowerOutputWatts").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let line_input = ps.get("LineInputVoltage").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let health = ps.get("Status").and_then(|s| s.get("Health")).and_then(|v| v.as_str()).unwrap_or("N/A").to_string();
            let state = ps.get("Status").and_then(|s| s.get("State")).and_then(|v| v.as_str()).unwrap_or("N/A").to_string();

            power_supplies.push(PSUInfo { name, model, serial_number, last_output, line_input, health, state });
        }
    }

    Ok((voltages, power_controls, power_supplies))
}

pub async fn execute_power_action(
    session: &RedfishSession,
    bmc_ip: &str,
    reset_type: &str,
) -> Result<()> {
    let reset_url = format!(
        "https://{}{}/Actions/ComputerSystem.Reset",
        bmc_ip, session.system_path
    );

    let body = json!({"ResetType": reset_type});
    let resp = session.client
        .post(&reset_url)
        .header("X-Auth-Token", &session.token)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .context("发送电源指令失败")?;

    if resp.status().is_success() || resp.status().as_u16() == 204 {
        Ok(())
    } else {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        anyhow::bail!("电源指令失败: {} - {}", status, err_text)
    }
}

/// 获取主机电源状态和运行时间 (from /redfish/v1/Systems/{id})
pub async fn poll_system(session: &RedfishSession, bmc_ip: &str) -> Result<(String, Option<f64>)> {
    let system_url = format!("https://{}{}", bmc_ip, session.system_path);

    let body: Value = session.client
        .get(&system_url)
        .header("X-Auth-Token", &session.token)
        .send()
        .await?
        .json()
        .await?;

    let power_state = body.get("PowerState")
        .and_then(|v| v.as_str())
        .unwrap_or("Off")
        .to_string();

    let uptime_seconds = body.get("UptimeSeconds")
        .and_then(|v| v.as_f64());

    Ok((power_state, uptime_seconds))
}
