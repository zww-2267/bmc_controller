# BMC 真实数据 API 对接 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Rust axum HTTP 后端服务，封装 Redfish 协议采集 BMC 传感器数据，前端通过 REST API 获取真实数据替换 mock。

**Architecture:** 单体 Rust HTTP server (axum, port 3001)，启动时建立 Redfish session 并每 10s 轮询缓存传感器数据。前端 shared/api/ 从 mock 延时/克隆切换为 axios 调用 `http://localhost:3001/api/`。BMC 凭据和路由器信息持久化在 `backend/config/bmcs.json`。

**Tech Stack:** Rust + axum 0.8 + tokio + reqwest 0.11 + serde_json + base64 + anyhow; 前端 React 19 + TypeScript + axios

---

### Task 1: 创建 Rust Backend 项目骨架

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/config/bmcs.json`
- Create: `backend/src/main.rs`
- Create: `backend/src/redfish.rs`
- Create: `backend/src/cache.rs`
- Create: `backend/src/config.rs`
- Create: `backend/src/handlers.rs`

- [ ] **Step 1: 创建 Cargo.toml**

```toml
[package]
name = "bmc-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["json", "native-tls"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
base64 = "0.21"
tower-http = { version = "0.6", features = ["cors"] }
parking_lot = "0.12"
```

- [ ] **Step 2: 创建配置文件 `backend/config/bmcs.json`**

```json
{
  "routers": [
    {
      "id": "router-1",
      "name": "核心路由器1",
      "location": "主数据中心",
      "bmcs": [
        {
          "id": "bmc-real-1",
          "ip": "192.168.2.101",
          "username": "admin",
          "password": "abc123.."
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: 创建 `backend/src/config.rs` — 配置文件读写**

```rust
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BmcDevice {
    pub id: String,
    pub ip: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterConfig {
    pub id: String,
    pub name: String,
    pub location: String,
    pub bmcs: Vec<BmcDevice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub routers: Vec<RouterConfig>,
}

pub type SharedConfig = Arc<RwLock<AppConfig>>;

pub fn load_config(path: &str) -> Result<AppConfig> {
    if Path::new(path).exists() {
        let content = fs::read_to_string(path).context("读取配置文件失败")?;
        serde_json::from_str(&content).context("解析配置文件失败")
    } else {
        Ok(AppConfig { routers: vec![] })
    }
}

pub fn save_config(path: &str, config: &AppConfig) -> Result<()> {
    let content = serde_json::to_string_pretty(config).context("序列化配置失败")?;
    fs::write(path, content).context("写入配置文件失败")?;
    Ok(())
}

pub fn find_bmc<'a>(config: &'a AppConfig, bmc_id: &str) -> Option<&'a BmcDevice> {
    config.routers.iter().flat_map(|r| &r.bmcs).find(|b| b.id == bmc_id)
}

pub fn find_bmc_router_name(config: &AppConfig, bmc_id: &str) -> Option<String> {
    config.routers.iter().find_map(|r| {
        r.bmcs.iter().find(|b| b.id == bmc_id).map(|_| r.name.clone())
    })
}
```

- [ ] **Step 4: 创建 `backend/src/cache.rs` — 传感器数据缓存**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub name: String,
    pub value: Option<f64>,
    pub units: Option<String>,
    pub health: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PSUInfo {
    pub name: String,
    pub model: String,
    pub serial_number: String,
    pub last_output: f64,
    pub line_input: f64,
    pub health: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerControlCache {
    pub name: String,
    pub power_consumed_watts: Option<f64>,
    pub health: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BmcSensorCache {
    pub temperatures: Vec<SensorReading>,
    pub fans: Vec<SensorReading>,
    pub voltages: Vec<SensorReading>,
    pub power_controls: Vec<PowerControlCache>,
    pub power_supplies: Vec<PSUInfo>,
    pub last_updated: u64,
}

impl BmcSensorCache {
    pub fn new() -> Self {
        BmcSensorCache {
            temperatures: vec![],
            fans: vec![],
            voltages: vec![],
            power_controls: vec![],
            power_supplies: vec![],
            last_updated: 0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BmcStatusCache {
    pub online: bool,
    pub first_seen: u64,
    pub consecutive_failures: u32,
}

#[derive(Debug, Clone)]
pub struct SensorCache {
    pub sensors: HashMap<String, BmcSensorCache>,
    pub statuses: HashMap<String, BmcStatusCache>,
}

impl SensorCache {
    pub fn new() -> Self {
        SensorCache {
            sensors: HashMap::new(),
            statuses: HashMap::new(),
        }
    }
}

pub type SharedSensorCache = Arc<RwLock<SensorCache>>;

pub fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}
```

- [ ] **Step 5: 创建 `backend/src/redfish.rs` — Redfish 客户端**

```rust
use anyhow::{Context, Result};
use base64::Engine;
use reqwest::{header, Client, StatusCode};
use serde_json::{json, Value};
use crate::cache::*;

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

    // 查找 Chassis 路径
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

    // 查找 Systems 路径
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

pub async fn delete_session(client: &Client, token: &str, session_loc: &str) {
    let _ = client.delete(session_loc).header("X-Auth-Token", token).send().await;
}
```

- [ ] **Step 6: 创建 `backend/src/handlers.rs` — axum handler 函数**

```rust
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::cache::*;
use crate::config::*;
use crate::redfish;

pub struct AppState {
    pub config: SharedConfig,
    pub cache: SharedSensorCache,
    pub sessions: Arc<parking_lot::RwLock<std::collections::HashMap<String, redfish::RedfishSession>>>,
    pub config_path: String,
}

// ========== 请求/响应类型 ==========

#[derive(Deserialize)]
pub struct BmcsQuery {
    #[serde(rename = "routerId")]
    pub router_id: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct PowerRequest {
    #[serde(rename = "rootPassword")]
    pub root_password: String,
}

#[derive(Deserialize)]
pub struct AddBmcRequest {
    #[serde(rename = "routerId")]
    pub router_id: String,
    pub ip: String,
    pub username: String,
    pub password: String,
}

// 前端兼容的 BMC 列表项
#[derive(Serialize)]
pub struct BmcListItem {
    pub id: String,
    pub ip: String,
    pub username: String,
    #[serde(rename = "routerId")]
    pub router_id: String,
    #[serde(rename = "routerName")]
    pub router_name: String,
    pub status: String,
    #[serde(rename = "lastSeen")]
    pub last_seen: String,
    pub uptime: u64,
}

// 前端兼容的 SensorData
#[derive(Serialize)]
pub struct SensorDataResponse {
    #[serde(rename = "bmcId")]
    pub bmc_id: String,
    pub timestamp: String,
    #[serde(rename = "coreTemp")]
    pub core_temp: serde_json::Value,
    #[serde(rename = "gpuTemp")]
    pub gpu_temp: serde_json::Value,
    #[serde(rename = "fanSpeed")]
    pub fan_speed: serde_json::Value,
    pub voltage: serde_json::Value,
    pub current: serde_json::Value,
    pub power: serde_json::Value,
    pub psu: Vec<serde_json::Value>,
}

// ========== Handler 实现 ==========

pub async fn login(Json(req): Json<LoginRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.username == "admin" && req.password == "abc123.." {
        Ok(Json(serde_json::json!({"success": true})))
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

pub async fn get_routers(State(state): State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    let config = state.config.read();
    let routers: Vec<_> = config.routers.iter().map(|r| {
        serde_json::json!({
            "id": r.id,
            "name": r.name,
            "location": r.location,
        })
    }).collect();
    Json(routers)
}

pub async fn get_bmcs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BmcsQuery>,
) -> Result<Json<Vec<BmcListItem>>, StatusCode> {
    let config = state.config.read();
    let cache = state.cache.read();

    let router = config.routers.iter().find(|r| r.id == params.router_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let bmcs: Vec<BmcListItem> = router.bmcs.iter().map(|b| {
        let status_cache = cache.statuses.get(&b.id);
        let online = status_cache.map(|s| s.online).unwrap_or(false);
        let uptime = status_cache
            .and_then(|s| if s.online { Some(now_secs().saturating_sub(s.first_seen)) } else { Some(0) })
            .unwrap_or(0);
        BmcListItem {
            id: b.id.clone(),
            ip: b.ip.clone(),
            username: b.username.clone(),
            router_id: router.id.clone(),
            router_name: router.name.clone(),
            status: if online { "online".to_string() } else { "offline".to_string() },
            last_seen: chrono_now(),
            uptime,
        }
    }).collect();

    Ok(Json(bmcs))
}

pub async fn get_bmc_status(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let config = state.config.read();
    let cache = state.cache.read();

    let _bmc = find_bmc(&config, &bmc_id).ok_or(StatusCode::NOT_FOUND)?;
    let status_cache = cache.statuses.get(&bmc_id);

    let online = status_cache.map(|s| s.online).unwrap_or(false);
    let uptime = status_cache
        .and_then(|s| if s.online { Some(now_secs().saturating_sub(s.first_seen)) } else { Some(0) })
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "bmcId": bmc_id,
        "status": if online { "online" } else { "offline" },
        "uptime": uptime,
    })))
}

fn sensor_value(name: &str, list: &[SensorReading]) -> Option<f64> {
    list.iter().find(|s| s.name.to_uppercase().ends_with(&name.to_uppercase()))
        .and_then(|s| s.value)
}

pub async fn get_bmc_sensors(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
) -> Result<Json<SensorDataResponse>, StatusCode> {
    let config = state.config.read();
    let cache = state.cache.read();

    let _bmc = find_bmc(&config, &bmc_id).ok_or(StatusCode::NOT_FOUND)?;
    let sensor_cache = cache.sensors.get(&bmc_id).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let temps = &sensor_cache.temperatures;
    let fans = &sensor_cache.fans;
    let volts = &sensor_cache.voltages;

    let core_temp = serde_json::json!({
        "cpu0Temp": sensor_value("CPU0_TEMP", temps),
        "dimmG0Temp": sensor_value("DIMMG0_TEMP", temps),
        "dimmG1Temp": sensor_value("DIMMG1_TEMP", temps),
        "mbTemp1": sensor_value("MB_TEMP1", temps),
        "mbTemp2": sensor_value("MB_TEMP2", temps),
        "inletAirTemp": sensor_value("INLET_AIR_TEMP", temps),
        "cpu0Dts": sensor_value("CPU0_DTS", temps),
        "vrP0Temp": sensor_value("VR_P0_TEMP", temps),
        "vrDimmG0Temp": sensor_value("VR_DIMMG0_TEMP", temps),
        "vrDimmG1Temp": sensor_value("VR_DIMMG1_TEMP", temps),
        "m2G0AmbTemp": sensor_value("M2_G0_AMB_TEMP", temps),
    });

    let gpu_temp = serde_json::json!({
        "gpu0Proc": sensor_value("GPU0_PROC", temps),
        "gpu1Proc": sensor_value("GPU1_PROC", temps),
        "gpu2Proc": sensor_value("GPU2_PROC", temps),
        "gpu3Proc": sensor_value("GPU3_PROC", temps),
        "gpu4Proc": sensor_value("GPU4_PROC", temps),
        "gpu5Proc": sensor_value("GPU5_PROC", temps),
        "gpu6Proc": sensor_value("GPU6_PROC", temps),
        "gpu7Proc": sensor_value("GPU7_PROC", temps),
        "hddTemp": sensor_value("HDD_TEMP", temps),
        "pdbTemp1": sensor_value("PDB_TEMP1", temps),
        "pdbTemp2": sensor_value("PDB_TEMP2", temps),
    });

    let fan_speed = serde_json::json!({
        "gpuFan12": sensor_value("GPU_FAN12", fans),
        "gpuFan56": sensor_value("GPU_FAN56", fans),
        "sysFan1": sensor_value("SYS_FAN1", fans),
        "sysFan2": sensor_value("SYS_FAN2", fans),
        "gpuFan34": sensor_value("GPU_FAN34", fans),
        "gpuFan78": sensor_value("GPU_FAN78", fans),
        "gpuFan12E": sensor_value("GPU_FAN12E", fans),
        "gpuFan56E": sensor_value("GPU_FAN56E", fans),
    });

    let voltage = serde_json::json!({
        "cpu0Vcore": sensor_value("P0_VDDCR_CPU", volts),
        "cpu0Vccin": sensor_value("P0_VDD_18", volts),
        "dimmG0Volt": sensor_value("VR_DIMMG0_VOUT", volts),
        "dimmG1Volt": sensor_value("VR_DIMMG1_VOUT", volts),
        "volt12v": sensor_value("P_12V", volts),
        "volt5v": sensor_value("P_5V", volts),
        "volt3v3": sensor_value("P_3V3", volts),
    });

    let current = serde_json::json!({
        "cpu0Current": sensor_value("VR_P0_IOUT", volts),
        "dimmG0Current": sensor_value("VR_DIMMG0_IOUT", volts),
        "dimmG1Current": sensor_value("VR_DIMMG1_IOUT", volts),
        "gpu0Current": sensor_value("12V_GPU0", volts),
    });

    let power = if let Some(pc) = sensor_cache.power_controls.first() {
        serde_json::json!({
            "chassisPower": pc.power_consumed_watts.unwrap_or(0.0),
            "chassisPowerHealth": pc.health,
            "chassisPowerState": pc.state,
        })
    } else {
        serde_json::json!({
            "chassisPower": 0,
            "chassisPowerHealth": "N/A",
            "chassisPowerState": "N/A",
        })
    };

    let psu: Vec<serde_json::Value> = sensor_cache.power_supplies.iter().map(|p| {
        serde_json::json!({
            "name": p.name,
            "model": p.model,
            "serialNumber": p.serial_number,
            "lastOutput": p.last_output,
            "lineInput": p.line_input,
            "health": p.health,
            "state": p.state,
        })
    }).collect();

    Ok(Json(SensorDataResponse {
        bmc_id,
        timestamp: chrono_now(),
        core_temp,
        gpu_temp,
        fan_speed,
        voltage,
        current,
        power,
        psu,
    }))
}

pub async fn power_on(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
    Json(req): Json<PowerRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.root_password != "123456" {
        return Err(StatusCode::FORBIDDEN);
    }
    execute_power_action_inner(&state, &bmc_id, "On").await
}

pub async fn power_off(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
    Json(req): Json<PowerRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.root_password != "123456" {
        return Err(StatusCode::FORBIDDEN);
    }
    execute_power_action_inner(&state, &bmc_id, "GracefulShutdown").await
}

pub async fn power_restart(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
    Json(req): Json<PowerRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.root_password != "123456" {
        return Err(StatusCode::FORBIDDEN);
    }
    execute_power_action_inner(&state, &bmc_id, "ForceRestart").await
}

async fn execute_power_action_inner(
    state: &Arc<AppState>,
    bmc_id: &str,
    reset_type: &str,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let (ip, session) = {
        let sessions = state.sessions.read();
        let config = state.config.read();
        let bmc = find_bmc(&config, bmc_id).ok_or(StatusCode::NOT_FOUND)?;
        let session = sessions.get(bmc_id).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
        (bmc.ip.clone(), session)
        // RedfishSession 不实现 Clone，所以我们需要不同的方式
    };

    // 实际实现中，由于 RedfishSession 不可 Clone，这里采用另一种方式：
    // 在 main.rs 中 session map 存储 (String, String) 元组，handler 中直接构建新请求
    // 为简化计划，此处展示逻辑——具体实现见 main.rs 完整代码
    Err(StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn add_bmc(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AddBmcRequest>,
) -> Result<Json<BmcListItem>, StatusCode> {
    let mut config = state.config.write();
    let router = config.routers.iter_mut()
        .find(|r| r.id == req.router_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let id = format!("bmc-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());

    let bmc = BmcDevice {
        id: id.clone(),
        ip: req.ip.clone(),
        username: req.username,
        password: req.password,
    };

    let item = BmcListItem {
        id: id.clone(),
        ip: req.ip,
        username: bmc.username.clone(),
        router_id: req.router_id.clone(),
        router_name: router.name.clone(),
        status: "offline".to_string(),
        last_seen: chrono_now(),
        uptime: 0,
    };

    router.bmcs.push(bmc);
    save_config(&state.config_path, &config).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(item))
}

pub async fn delete_bmc(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut config = state.config.write();
    for router in &mut config.routers {
        if let Some(idx) = router.bmcs.iter().position(|b| b.id == bmc_id) {
            router.bmcs.remove(idx);
            save_config(&state.config_path, &config).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            return Ok(Json(serde_json::json!({"success": true})));
        }
    }
    Err(StatusCode::NOT_FOUND)
}

fn chrono_now() -> String {
    // 简化版 ISO 8601 时间戳
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let secs = now.as_secs();
    // 返回 ISO 格式
    format!("{:?}", std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs))
    // 实际使用 chrono crate，此处为简化
}
```

- [ ] **Step 7: 创建 `backend/src/main.rs` — axum server 入口 + 轮询循环**

```rust
mod config;
mod cache;
mod redfish;
mod handlers;

use anyhow::Result;
use axum::{routing::{get, post, delete}, Router};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tokio::time::{sleep, Duration};

use cache::*;
use config::*;
use handlers::AppState;

const CONFIG_PATH: &str = "config/bmcs.json";

#[tokio::main]
async fn main() -> Result<()> {
    let app_config = load_config(CONFIG_PATH)?;
    let config = Arc::new(parking_lot::RwLock::new(app_config));
    let cache = Arc::new(parking_lot::RwLock::new(SensorCache::new()));
    let sessions: Arc<parking_lot::RwLock<HashMap<String, redfish::RedfishSession>>> =
        Arc::new(parking_lot::RwLock::new(HashMap::new()));

    let state = Arc::new(AppState {
        config: config.clone(),
        cache: cache.clone(),
        sessions: sessions.clone(),
        config_path: CONFIG_PATH.to_string(),
    });

    // 启动后台轮询任务
    let poll_state = state.clone();
    tokio::spawn(async move {
        polling_loop(poll_state).await;
    });

    // CORS 层：允许 3 个前端 dev server
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/auth/login", post(handlers::login))
        .route("/api/routers", get(handlers::get_routers))
        .route("/api/bmcs", get(handlers::get_bmcs))
        .route("/api/bmcs/:id/status", get(handlers::get_bmc_status))
        .route("/api/bmcs/:id/sensors", get(handlers::get_bmc_sensors))
        .route("/api/bmcs/:id/power/on", post(handlers::power_on))
        .route("/api/bmcs/:id/power/off", post(handlers::power_off))
        .route("/api/bmcs/:id/power/restart", post(handlers::power_restart))
        .route("/api/bmcs", post(handlers::add_bmc))
        .route("/api/bmcs/:id", delete(handlers::delete_bmc))
        .layer(cors)
        .with_state(state);

    println!("[*] Backend server listening on http://0.0.0.0:3001");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn polling_loop(state: Arc<AppState>) {
    loop {
        // 获取所有 BMC 列表
        let bmcs: Vec<(String, String, String, String)> = {
            let config = state.config.read();
            config.routers.iter()
                .flat_map(|r| r.bmcs.iter().map(move |b| {
                    (b.id.clone(), b.ip.clone(), b.username.clone(), b.password.clone())
                }))
                .collect()
        };

        for (bmc_id, ip, user, pass) in &bmcs {
            // 确保 session 存在
            {
                let mut sessions = state.sessions.write();
                if !sessions.contains_key(bmc_id) {
                    match redfish::create_session(ip, user, pass).await {
                        Ok(session) => {
                            sessions.insert(bmc_id.clone(), session);
                            let mut cache = state.cache.write();
                            cache.sensors.entry(bmc_id.clone()).or_insert_with(BmcSensorCache::new);
                            cache.statuses.entry(bmc_id.clone()).or_insert_with(|| BmcStatusCache {
                                online: true,
                                first_seen: now_secs(),
                                consecutive_failures: 0,
                            });
                        }
                        Err(e) => {
                            eprintln!("[{}] 创建 session 失败: {}", bmc_id, e);
                            continue;
                        }
                    }
                }
            }

            // 轮询数据
            let session_guard = state.sessions.read();
            let session = match session_guard.get(bmc_id) {
                Some(s) => s,
                None => continue,
            };

            let thermal_result = redfish::poll_thermal(session).await;
            let power_result = redfish::poll_power(session).await;
            drop(session_guard);

            let mut cache = state.cache.write();
            let sensor_cache = cache.sensors.entry(bmc_id.clone()).or_insert_with(BmcSensorCache::new);
            let status_cache = cache.statuses.entry(bmc_id.clone()).or_insert_with(|| BmcStatusCache {
                online: true,
                first_seen: now_secs(),
                consecutive_failures: 0,
            });

            match thermal_result {
                Ok((temps, fans)) => {
                    sensor_cache.temperatures = temps;
                    sensor_cache.fans = fans;
                    status_cache.consecutive_failures = 0;
                    status_cache.online = true;
                }
                Err(e) => {
                    eprintln!("[{}] Thermal 轮询失败: {}", bmc_id, e);
                    status_cache.consecutive_failures += 1;
                }
            }

            match power_result {
                Ok((volts, pc, ps)) => {
                    sensor_cache.voltages = volts;
                    sensor_cache.power_controls = pc;
                    sensor_cache.power_supplies = ps;
                    status_cache.consecutive_failures = 0;
                    status_cache.online = true;
                }
                Err(e) => {
                    eprintln!("[{}] Power 轮询失败: {}", bmc_id, e);
                    status_cache.consecutive_failures += 1;
                }
            }

            if status_cache.consecutive_failures >= 3 {
                status_cache.online = false;
            }

            sensor_cache.last_updated = now_secs();
        }

        sleep(Duration::from_secs(10)).await;
    }
}
```

- [ ] **Step 8: 编译验证 backend 项目**

Run:
```bash
cd /home/zww/pro/testapi/backend && cargo build 2>&1
```
Expected: 编译成功，零错误。

- [ ] **Step 9: Commit**

```bash
cd /home/zww/pro/testapi && git add backend/ && git commit -m "feat: add Rust axum backend project with Redfish client and sensor cache"
```

---

### Task 2: 修复 handlers.rs 中的 power handler 实现 + 时间戳 crate

**Files:**
- Modify: `backend/Cargo.toml`
- Modify: `backend/src/handlers.rs`
- Modify: `backend/src/main.rs`

- [ ] **Step 1: 添加 chrono 依赖到 Cargo.toml**

Edit `backend/Cargo.toml`，在 `[dependencies]` 中添加：
```toml
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 2: 重写 `backend/src/handlers.rs` — 修复 power 操作和时间戳**

将 `handlers.rs` 中的 `execute_power_action_inner` 替换为直接在 handler 中构建 reqwest client 执行电源操作，`chrono_now` 使用 chrono crate：

```rust
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::cache::*;
use crate::config::*;
use crate::redfish;

pub struct AppState {
    pub config: SharedConfig,
    pub cache: SharedSensorCache,
    pub sessions: Arc<parking_lot::RwLock<std::collections::HashMap<String, redfish::RedfishSession>>>,
    pub config_path: String,
}

// ========== 请求/响应类型 ==========

#[derive(Deserialize)]
pub struct BmcsQuery {
    #[serde(alias = "routerId")]
    pub router_id: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct PowerRequest {
    #[serde(alias = "rootPassword")]
    pub root_password: String,
}

#[derive(Deserialize)]
pub struct AddBmcRequest {
    #[serde(alias = "routerId")]
    pub router_id: String,
    pub ip: String,
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct BmcListItem {
    pub id: String,
    pub ip: String,
    pub username: String,
    #[serde(rename = "routerId")]
    pub router_id: String,
    #[serde(rename = "routerName")]
    pub router_name: String,
    pub status: String,
    #[serde(rename = "lastSeen")]
    pub last_seen: String,
    pub uptime: u64,
}

#[derive(Serialize)]
pub struct SensorDataResponse {
    #[serde(rename = "bmcId")]
    pub bmc_id: String,
    pub timestamp: String,
    #[serde(rename = "coreTemp")]
    pub core_temp: serde_json::Value,
    #[serde(rename = "gpuTemp")]
    pub gpu_temp: serde_json::Value,
    #[serde(rename = "fanSpeed")]
    pub fan_speed: serde_json::Value,
    pub voltage: serde_json::Value,
    pub current: serde_json::Value,
    pub power: serde_json::Value,
    pub psu: Vec<serde_json::Value>,
}

// ========== Handler 实现 ==========

pub async fn login(Json(req): Json<LoginRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.username == "admin" && req.password == "abc123.." {
        Ok(Json(serde_json::json!({"success": true})))
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

pub async fn get_routers(State(state): State<Arc<AppState>>) -> Json<Vec<serde_json::Value>> {
    let config = state.config.read();
    let routers: Vec<_> = config.routers.iter().map(|r| {
        serde_json::json!({
            "id": r.id,
            "name": r.name,
            "location": r.location,
        })
    }).collect();
    Json(routers)
}

pub async fn get_bmcs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<BmcsQuery>,
) -> Result<Json<Vec<BmcListItem>>, StatusCode> {
    let config = state.config.read();
    let cache = state.cache.read();

    let router = config.routers.iter().find(|r| r.id == params.router_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let bmcs: Vec<BmcListItem> = router.bmcs.iter().map(|b| {
        let status_cache = cache.statuses.get(&b.id);
        let online = status_cache.map(|s| s.online).unwrap_or(false);
        let uptime = status_cache
            .and_then(|s| if s.online { Some(now_secs().saturating_sub(s.first_seen)) } else { Some(0) })
            .unwrap_or(0);
        BmcListItem {
            id: b.id.clone(),
            ip: b.ip.clone(),
            username: b.username.clone(),
            router_id: router.id.clone(),
            router_name: router.name.clone(),
            status: if online { "online".to_string() } else { "offline".to_string() },
            last_seen: chrono::Utc::now().to_rfc3339(),
            uptime,
        }
    }).collect();

    Ok(Json(bmcs))
}

pub async fn get_bmc_status(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let config = state.config.read();
    let cache = state.cache.read();

    find_bmc(&config, &bmc_id).ok_or(StatusCode::NOT_FOUND)?;
    let status_cache = cache.statuses.get(&bmc_id);

    let online = status_cache.map(|s| s.online).unwrap_or(false);
    let uptime = status_cache
        .and_then(|s| if s.online { Some(now_secs().saturating_sub(s.first_seen)) } else { Some(0) })
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "bmcId": bmc_id,
        "status": if online { "online" } else { "offline" },
        "uptime": uptime,
    })))
}

fn sensor_value(name: &str, list: &[SensorReading]) -> Option<f64> {
    list.iter().find(|s| s.name.to_uppercase().ends_with(&name.to_uppercase()))
        .and_then(|s| s.value)
}

pub async fn get_bmc_sensors(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
) -> Result<Json<SensorDataResponse>, StatusCode> {
    let config = state.config.read();
    let cache = state.cache.read();

    find_bmc(&config, &bmc_id).ok_or(StatusCode::NOT_FOUND)?;
    let sensor_cache = cache.sensors.get(&bmc_id).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let temps = &sensor_cache.temperatures;
    let fans = &sensor_cache.fans;
    let volts = &sensor_cache.voltages;

    let core_temp = serde_json::json!({
        "cpu0Temp": sensor_value("CPU0_TEMP", temps),
        "dimmG0Temp": sensor_value("DIMMG0_TEMP", temps),
        "dimmG1Temp": sensor_value("DIMMG1_TEMP", temps),
        "mbTemp1": sensor_value("MB_TEMP1", temps),
        "mbTemp2": sensor_value("MB_TEMP2", temps),
        "inletAirTemp": sensor_value("INLET_AIR_TEMP", temps),
        "cpu0Dts": sensor_value("CPU0_DTS", temps),
        "vrP0Temp": sensor_value("VR_P0_TEMP", temps),
        "vrDimmG0Temp": sensor_value("VR_DIMMG0_TEMP", temps),
        "vrDimmG1Temp": sensor_value("VR_DIMMG1_TEMP", temps),
        "m2G0AmbTemp": sensor_value("M2_G0_AMB_TEMP", temps),
    });

    let gpu_temp = serde_json::json!({
        "gpu0Proc": sensor_value("GPU0_PROC", temps),
        "gpu1Proc": sensor_value("GPU1_PROC", temps),
        "gpu2Proc": sensor_value("GPU2_PROC", temps),
        "gpu3Proc": sensor_value("GPU3_PROC", temps),
        "gpu4Proc": sensor_value("GPU4_PROC", temps),
        "gpu5Proc": sensor_value("GPU5_PROC", temps),
        "gpu6Proc": sensor_value("GPU6_PROC", temps),
        "gpu7Proc": sensor_value("GPU7_PROC", temps),
        "hddTemp": sensor_value("HDD_TEMP", temps),
        "pdbTemp1": sensor_value("PDB_TEMP1", temps),
        "pdbTemp2": sensor_value("PDB_TEMP2", temps),
    });

    let fan_speed = serde_json::json!({
        "gpuFan12": sensor_value("GPU_FAN12", fans).or_else(|| sensor_value("GPU_FAN12E", fans)),
        "gpuFan56": sensor_value("GPU_FAN56", fans).or_else(|| sensor_value("GPU_FAN56E", fans)),
        "sysFan1": sensor_value("SYS_FAN1", fans),
        "sysFan2": sensor_value("SYS_FAN2", fans),
        "gpuFan34": sensor_value("GPU_FAN34", fans),
        "gpuFan78": sensor_value("GPU_FAN78", fans),
        "gpuFan12E": sensor_value("GPU_FAN12E", fans),
        "gpuFan56E": sensor_value("GPU_FAN56E", fans),
    });

    let voltage = serde_json::json!({
        "cpu0Vcore": sensor_value("P0_VDDCR_CPU", volts),
        "cpu0Vccin": sensor_value("P0_VDD_18", volts),
        "dimmG0Volt": sensor_value("VR_DIMMG0_VOUT", volts),
        "dimmG1Volt": sensor_value("VR_DIMMG1_VOUT", volts),
        "volt12v": sensor_value("P_12V", volts),
        "volt5v": sensor_value("P_5V", volts),
        "volt3v3": sensor_value("P_3V3", volts),
    });

    let current = serde_json::json!({
        "cpu0Current": sensor_value("VR_P0_IOUT", volts),
        "dimmG0Current": sensor_value("VR_DIMMG0_IOUT", volts),
        "dimmG1Current": sensor_value("VR_DIMMG1_IOUT", volts),
        "gpu0Current": sensor_value("12V_GPU0", volts),
    });

    let power = if let Some(pc) = sensor_cache.power_controls.first() {
        serde_json::json!({
            "chassisPower": pc.power_consumed_watts.unwrap_or(0.0),
            "chassisPowerHealth": pc.health,
            "chassisPowerState": pc.state,
        })
    } else {
        serde_json::json!({
            "chassisPower": 0,
            "chassisPowerHealth": "N/A",
            "chassisPowerState": "N/A",
        })
    };

    let psu: Vec<serde_json::Value> = sensor_cache.power_supplies.iter().map(|p| {
        serde_json::json!({
            "name": p.name,
            "model": p.model,
            "serialNumber": p.serial_number,
            "lastOutput": p.last_output,
            "lineInput": p.line_input,
            "health": p.health,
            "state": p.state,
        })
    }).collect();

    Ok(Json(SensorDataResponse {
        bmc_id,
        timestamp: chrono::Utc::now().to_rfc3339(),
        core_temp,
        gpu_temp,
        fan_speed,
        voltage,
        current,
        power,
        psu,
    }))
}

pub async fn power_on(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
    Json(req): Json<PowerRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.root_password != "123456" {
        return Err(StatusCode::FORBIDDEN);
    }
    power_action(&state, &bmc_id, "On").await
}

pub async fn power_off(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
    Json(req): Json<PowerRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.root_password != "123456" {
        return Err(StatusCode::FORBIDDEN);
    }
    power_action(&state, &bmc_id, "GracefulShutdown").await
}

pub async fn power_restart(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
    Json(req): Json<PowerRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.root_password != "123456" {
        return Err(StatusCode::FORBIDDEN);
    }
    power_action(&state, &bmc_id, "ForceRestart").await
}

async fn power_action(
    state: &Arc<AppState>,
    bmc_id: &str,
    reset_type: &str,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sessions = state.sessions.read();
    let config = state.config.read();
    let bmc = find_bmc(&config, bmc_id).ok_or(StatusCode::NOT_FOUND)?;
    let session = sessions.get(bmc_id).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    redfish::execute_power_action(session, &bmc.ip, reset_type)
        .await
        .map_err(|e| {
            eprintln!("Power action failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn add_bmc(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AddBmcRequest>,
) -> Result<Json<BmcListItem>, StatusCode> {
    let mut config = state.config.write();
    let router = config.routers.iter_mut()
        .find(|r| r.id == req.router_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let id = format!("bmc-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());

    let bmc = BmcDevice {
        id: id.clone(),
        ip: req.ip.clone(),
        username: req.username,
        password: req.password,
    };

    let item = BmcListItem {
        id: id.clone(),
        ip: req.ip,
        username: bmc.username.clone(),
        router_id: req.router_id.clone(),
        router_name: router.name.clone(),
        status: "offline".to_string(),
        last_seen: chrono::Utc::now().to_rfc3339(),
        uptime: 0,
    };

    router.bmcs.push(bmc);
    save_config(&state.config_path, &config).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(item))
}

pub async fn delete_bmc(
    State(state): State<Arc<AppState>>,
    Path(bmc_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut config = state.config.write();
    for router in &mut config.routers {
        if let Some(idx) = router.bmcs.iter().position(|b| b.id == bmc_id) {
            router.bmcs.remove(idx);
            save_config(&state.config_path, &config).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            return Ok(Json(serde_json::json!({"success": true})));
        }
    }
    Err(StatusCode::NOT_FOUND)
}
```

- [ ] **Step 3: 更新 `backend/src/main.rs` 移除未使用的 import**

确认 main.rs 中 `use cache::*;` 和 `use config::*;` 正常编译。

- [ ] **Step 4: 编译验证**

Run:
```bash
cd /home/zww/pro/testapi/backend && cargo build 2>&1
```
Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
cd /home/zww/pro/testapi && git add backend/ && git commit -m "fix: complete power handlers and add chrono dependency"
```

---

### Task 3: 前端 shared/api/ 切换到真实 API

**Files:**
- Modify: `shared/api/client.ts`
- Modify: `shared/api/bmc.ts`
- Modify: `shared/api/routers.ts`
- Modify: `shared/api/sensors.ts`
- Modify: `shared/stores/rootStore.ts`

- [ ] **Step 1: 安装 axios 依赖**

Run:
```bash
cd /home/zww/pro/testapi && npm install axios
```

- [ ] **Step 2: 重写 `shared/api/client.ts`**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10_000,
});

export default api;
```

- [ ] **Step 3: 重写 `shared/api/bmc.ts`**

```typescript
import type { BMC, BMCCreateInput } from '../types';
import api from './client';

export async function fetchBMCsByRouter(routerId: string): Promise<BMC[]> {
  const { data } = await api.get('/bmcs', { params: { routerId } });
  return data;
}

export async function fetchAllBMCs(): Promise<BMC[]> {
  const { data } = await api.get('/bmcs');
  return data;
}

export async function fetchBMCById(id: string): Promise<BMC | null> {
  const { data } = await api.get(`/bmcs/${id}/status`);
  // 合并 status 端点到 BMC 类型
  return {
    id: data.bmcId,
    ip: '',
    username: '',
    routerId: '',
    status: data.status,
    lastSeen: '',
    uptime: data.uptime,
  };
}

export async function createBMC(input: BMCCreateInput): Promise<BMC> {
  const { data } = await api.post('/bmcs', input);
  return data;
}

export async function deleteBMC(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/bmcs/${id}`);
  return data;
}

export async function fetchBMCStatus(id: string): Promise<{ bmcId: string; status: string; uptime: number }> {
  const { data } = await api.get(`/bmcs/${id}/status`);
  return data;
}
```

- [ ] **Step 4: 重写 `shared/api/routers.ts`**

```typescript
import type { Router } from '../types';
import api from './client';

export async function fetchRouters(): Promise<Router[]> {
  const { data } = await api.get('/routers');
  return data;
}

export async function createRouter(input: Omit<Router, 'id'>): Promise<Router> {
  // 后端暂不支持创建路由器，保留 mock 逻辑
  return { ...input, id: `r-${Date.now()}` };
}

export async function deleteRouter(id: string): Promise<{ success: boolean }> {
  // 后端暂不支持删除路由器
  return { success: true };
}
```

- [ ] **Step 5: 重写 `shared/api/sensors.ts`**

```typescript
import type { SensorData, SensorSummary, CpuTempHistory } from '../types';
import api from './client';

export async function fetchSensorData(bmcId: string): Promise<SensorData> {
  const { data } = await api.get(`/bmcs/${bmcId}/sensors`);
  return data;
}

export async function fetchAllSensorSummaries(): Promise<SensorSummary[]> {
  // 获取所有 BMC 的摘要：先取 routers，取所有 bmcs，再取 sensor
  const { data: routers } = await api.get('/routers');
  const summaries: SensorSummary[] = [];
  for (const router of routers) {
    const { data: bmcs } = await api.get('/bmcs', { params: { routerId: router.id } });
    for (const bmc of bmcs) {
      try {
        const { data: sensors } = await api.get(`/bmcs/${bmc.id}/sensors`);
        summaries.push({
          bmcId: bmc.id,
          bmcIp: bmc.ip,
          routerName: router.name,
          status: bmc.status,
          cpu0Temp: sensors.coreTemp?.cpu0Temp ?? null,
          inletAirTemp: sensors.coreTemp?.inletAirTemp ?? null,
          chassisPower: sensors.power?.chassisPower ?? 0,
          hasError: bmc.status !== 'online' || (sensors.power?.chassisPowerHealth === 'Critical'),
          timestamp: sensors.timestamp,
        });
      } catch {
        summaries.push({
          bmcId: bmc.id,
          bmcIp: bmc.ip,
          routerName: router.name,
          status: 'offline',
          cpu0Temp: null,
          inletAirTemp: null,
          chassisPower: 0,
          hasError: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
  return summaries;
}

export async function fetchCpuTempHistory(bmcId: string, _minutes?: number): Promise<CpuTempHistory> {
  const { data } = await api.get(`/bmcs/${bmcId}/sensors`);
  return {
    bmcId,
    bmcIp: '',
    points: [{ time: data.timestamp, value: data.coreTemp?.cpu0Temp ?? null }],
  };
}

export async function fetchMultiCpuHistory(bmcIds: string[], _minutes?: number): Promise<CpuTempHistory[]> {
  return Promise.all(bmcIds.map(id => fetchCpuTempHistory(id)));
}
```

- [ ] **Step 6: 修改 `shared/stores/rootStore.ts` — unlock 调用后端登录**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../api/client';

interface RootState {
  isRoot: boolean;
  rootUnlocking: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

const ROOT_PASSWORD = '123456';

export const useRootStore = create<RootState>()(
  persist(
    (set) => ({
      isRoot: false,
      rootUnlocking: false,
      unlock: async (password: string) => {
        // 前端本地验证 rootPassword 用于 power 操作
        if (password === ROOT_PASSWORD) {
          set({ isRoot: true });
          return true;
        }
        // 尝试验证后端登录凭据
        try {
          await api.post('/auth/login', { username: 'admin', password });
          set({ isRoot: true });
          return true;
        } catch {
          return false;
        }
      },
      lock: () => set({ isRoot: false }),
    }),
    { name: 'root-auth', storage: createJSONStorage(() => sessionStorage) },
  ),
);
```

- [ ] **Step 7: TypeScript 编译验证**

Run:
```bash
cd /home/zww/pro/testapi && npx tsc --noEmit -p app-bmc-detail/tsconfig.json 2>&1 && npx tsc --noEmit -p app-bmc-monitor/tsconfig.json 2>&1 && npx tsc --noEmit -p app-router-manager/tsconfig.json 2>&1
```
Expected: 零 TypeScript 错误。

- [ ] **Step 8: Commit**

```bash
cd /home/zww/pro/testapi && git add shared/api/ shared/stores/rootStore.ts package.json package-lock.json && git commit -m "feat: switch frontend shared/api from mock to real axios API"
```

---

### Task 4: 修复前端细节 — BMC 详情页电源操作接线 + Login 页面真实验证

**Files:**
- Modify: `app-bmc-detail/src/pages/BMCDetailPage.tsx`
- Modify: `app-bmc-detail/src/pages/LoginPage.tsx`
- Modify: `app-bmc-detail/src/components/RootButton.tsx`

- [ ] **Step 1: 读取 `RootButton.tsx` 确认当前实现**

Run:
```bash
cat /home/zww/pro/testapi/app-bmc-detail/src/components/RootButton.tsx
```

- [ ] **Step 2: 修改 `BMCDetailPage.tsx` — 电源按钮调用真实 API**

将开机/关机/重启按钮的 onClick 改为调用后端 API：

```typescript
import api from '@shared/api/client';

// 在组件内：
const handlePowerOn = async () => {
  try {
    await api.post(`/bmcs/${bmcId}/power/on`, { rootPassword: '123456' });
    message.success(`已向 ${bmc!.ip} 发送开机指令`);
  } catch {
    message.error('开机指令发送失败');
  }
};

const handlePowerOff = async () => {
  try {
    await api.post(`/bmcs/${bmcId}/power/off`, { rootPassword: '123456' });
    message.success(`已向 ${bmc!.ip} 发送关机指令`);
  } catch {
    message.error('关机指令发送失败');
  }
};

const handlePowerRestart = async () => {
  try {
    await api.post(`/bmcs/${bmcId}/power/restart`, { rootPassword: '123456' });
    message.success(`已向 ${bmc!.ip} 发送重启指令`);
  } catch {
    message.error('重启指令发送失败');
  }
};
```

将按钮 onClick 绑定到对应 handler，并在 Space 中增加重启按钮。

- [ ] **Step 3: 修改 `LoginPage.tsx` — 密码验证支持后端**

Login 页面当前前端硬编码验证。由于后端 `/api/auth/login` 验证 `admin:abc123..`，且 `rootStore.unlock` 已改为调用后端，Login 页面保持不变（其当前逻辑 `username !== 'admin' || password !== 'abc123..'` 仍有效）。

无需变更。

- [ ] **Step 4: TypeScript 编译验证**

Run:
```bash
cd /home/zww/pro/testapi && npx tsc --noEmit -p app-bmc-detail/tsconfig.json 2>&1
```
Expected: 零错误。

- [ ] **Step 5: Commit**

```bash
cd /home/zww/pro/testapi && git add app-bmc-detail/ && git commit -m "feat: wire power buttons to real backend API"
```

---

### Task 5: 集成验证 — 后端 + 三前端联合运行

- [ ] **Step 1: 启动 Rust backend**

Run:
```bash
cd /home/zww/pro/testapi/backend && cargo run 2>&1 &
```
Expected: 输出 `[*] Backend server listening on http://0.0.0.0:3001`，无 panic。

- [ ] **Step 2: 验证 API 端点 — 登录**

Run:
```bash
curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"abc123.."}' | python3 -m json.tool
```
Expected: `{"success": true}`

- [ ] **Step 3: 验证 API 端点 — 路由器列表**

Run:
```bash
curl -s http://localhost:3001/api/routers | python3 -m json.tool
```
Expected: 返回包含 "核心路由器1" 的数组。

- [ ] **Step 4: 验证 API 端点 — BMC 列表**

Run:
```bash
curl -s 'http://localhost:3001/api/bmcs?routerId=router-1' | python3 -m json.tool
```
Expected: 返回 `192.168.2.101` 的 BMC。

- [ ] **Step 5: 验证 API 端点 — BMC 传感器数据**

Run:
```bash
curl -s http://localhost:3001/api/bmcs/bmc-real-1/sensors | python3 -m json.tool
```
Expected: 返回包含 coreTemp/gpuTemp/fanSpeed/voltage/current/power/psu 的 JSON。

- [ ] **Step 6: 启动前端三应用**

在三个终端分别启动：
```bash
cd /home/zww/pro/testapi && npm run dev --prefix app-router-manager
cd /home/zww/pro/testapi && npm run dev --prefix app-bmc-detail
cd /home/zww/pro/testapi && npm run dev --prefix app-bmc-monitor
```

在浏览器中验证：
1. App1 (5173): 能看到 "核心路由器1" 及其下的 BMC `192.168.2.101`
2. App2 (5174): 登录后能看到真实传感器数据（温度、风扇、电压、PSU）
3. App3 (5175): BMC 查询能显示真实在线状态和 uptime

- [ ] **Step 7: 停止 backend 并清理**

```bash
kill $(lsof -t -i:3001) 2>/dev/null; echo "stopped"
```

- [ ] **Step 8: Commit**

```bash
cd /home/zww/pro/testapi && git add -A && git commit -m "feat: integration verified — backend + 3 frontend apps"
```

---
