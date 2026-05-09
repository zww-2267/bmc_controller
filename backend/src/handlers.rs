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
    let upper = name.to_uppercase();
    list.iter().find(|s| s.name.to_uppercase().contains(&upper))
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
    let (session, bmc_ip) = {
        let sessions = state.sessions.read();
        let config = state.config.read();
        let bmc = find_bmc(&config, bmc_id).ok_or(StatusCode::NOT_FOUND)?;
        let session = sessions.get(bmc_id).ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
        (session.clone(), bmc.ip.clone())
    };

    redfish::execute_power_action(&session, &bmc_ip, reset_type)
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
            drop(config);
            {
                let mut cache = state.cache.write();
                cache.sensors.remove(&bmc_id);
                cache.statuses.remove(&bmc_id);
            }
            state.sessions.write().remove(&bmc_id);
            return Ok(Json(serde_json::json!({"success": true})));
        }
    }
    Err(StatusCode::NOT_FOUND)
}
