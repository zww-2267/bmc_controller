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
    #[serde(rename = "hostPowerOn")]
    pub host_power_on: bool,
    #[serde(rename = "aggregateHealth")]
    pub aggregate_health: serde_json::Value,
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
    #[serde(rename = "aggregateHealth")]
    pub aggregate_health: serde_json::Value,
}

const STATUS_ERROR: &str = "error";
const STATUS_OFFLINE: &str = "offline";
const STATUS_WARNING: &str = "warning";
const STATUS_ONLINE: &str = "online";

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
        let sensor_cache = cache.sensors.get(&b.id);
        let host_on = status_cache.map(|s| s.host_power_on).unwrap_or(false);
        let uptime = status_cache.map(|s| {
            if s.host_power_on {
                s.host_uptime_accumulated.saturating_add(now_secs().saturating_sub(s.host_power_on_since))
            } else {
                s.host_uptime_accumulated
            }
        }).unwrap_or(0);
        let bmc_reachable = status_cache.map(|s| s.bmc_reachable).unwrap_or(false);
        let agg_health = sensor_cache.map(|sc| &sc.aggregate_health);
        let status = if !bmc_reachable { STATUS_ERROR }
            else if !host_on { STATUS_OFFLINE }
            else if agg_health.map(|h| h.level >= SensorHealthLevel::Warning).unwrap_or(false) { STATUS_WARNING }
            else { STATUS_ONLINE };
        let aggregate_health = agg_health.map(|h| serde_json::json!({
            "level": h.level,
            "reasons": h.reasons,
        })).unwrap_or(serde_json::json!({"level": "normal", "reasons": []}));
        BmcListItem {
            id: b.id.clone(),
            ip: b.ip.clone(),
            username: b.username.clone(),
            router_id: router.id.clone(),
            router_name: router.name.clone(),
            status: status.to_string(),
            last_seen: chrono::Utc::now().to_rfc3339(),
            uptime,
            host_power_on: host_on,
            aggregate_health,
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

    let bmc = find_bmc(&config, &bmc_id).ok_or(StatusCode::NOT_FOUND)?;
    let router = config.routers.iter().find(|r| r.bmcs.iter().any(|b| b.id == bmc_id));
    let status_cache = cache.statuses.get(&bmc_id);

    let host_on = status_cache.map(|s| s.host_power_on).unwrap_or(false);
    let bmc_reachable = status_cache.map(|s| s.bmc_reachable).unwrap_or(false);
    let uptime = status_cache.map(|s| {
        if s.host_power_on {
            s.host_uptime_accumulated.saturating_add(now_secs().saturating_sub(s.host_power_on_since))
        } else {
            s.host_uptime_accumulated
        }
    }).unwrap_or(0);
    let sensor_cache = cache.sensors.get(&bmc_id);
    let agg_health = sensor_cache.map(|sc| &sc.aggregate_health);
    let status = if !bmc_reachable { STATUS_ERROR }
        else if !host_on { STATUS_OFFLINE }
        else if agg_health.map(|h| h.level >= SensorHealthLevel::Warning).unwrap_or(false) { STATUS_WARNING }
        else { STATUS_ONLINE };
    let aggregate_health = agg_health.map(|h| serde_json::json!({
        "level": h.level,
        "reasons": h.reasons,
    })).unwrap_or(serde_json::json!({"level": "normal", "reasons": []}));

    Ok(Json(serde_json::json!({
        "id": bmc_id,
        "ip": bmc.ip,
        "username": bmc.username,
        "routerId": router.map(|r| r.id.clone()),
        "routerName": router.map(|r| r.name.clone()),
        "status": status,
        "lastSeen": chrono::Utc::now().to_rfc3339(),
        "uptime": uptime,
        "hostPowerOn": host_on,
        "aggregateHealth": aggregate_health,
    })))
}

fn sensor_with_health(name: &str, list: &[SensorReading]) -> serde_json::Value {
    let upper = name.to_uppercase();
    match list.iter().find(|s| s.name.to_uppercase().contains(&upper)) {
        Some(s) => serde_json::json!({
            "value": s.value,
            "health": s.health,
        }),
        None => serde_json::json!({"value": null, "health": null}),
    }
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
        "cpu0Temp": sensor_with_health("CPU0_TEMP", temps),
        "dimmG0Temp": sensor_with_health("DIMMG0_TEMP", temps),
        "dimmG1Temp": sensor_with_health("DIMMG1_TEMP", temps),
        "mbTemp1": sensor_with_health("MB_TEMP1", temps),
        "mbTemp2": sensor_with_health("MB_TEMP2", temps),
        "inletAirTemp": sensor_with_health("INLET_AIR_TEMP", temps),
        "cpu0Dts": sensor_with_health("CPU0_DTS", temps),
        "vrP0Temp": sensor_with_health("VR_P0_TEMP", temps),
        "vrDimmG0Temp": sensor_with_health("VR_DIMMG0_TEMP", temps),
        "vrDimmG1Temp": sensor_with_health("VR_DIMMG1_TEMP", temps),
        "m2G0AmbTemp": sensor_with_health("M2_G0_AMB_TEMP", temps),
    });

    let gpu_temp = serde_json::json!({
        "gpu0Proc": sensor_with_health("GPU0_PROC", temps),
        "gpu1Proc": sensor_with_health("GPU1_PROC", temps),
        "gpu2Proc": sensor_with_health("GPU2_PROC", temps),
        "gpu3Proc": sensor_with_health("GPU3_PROC", temps),
        "gpu4Proc": sensor_with_health("GPU4_PROC", temps),
        "gpu5Proc": sensor_with_health("GPU5_PROC", temps),
        "gpu6Proc": sensor_with_health("GPU6_PROC", temps),
        "gpu7Proc": sensor_with_health("GPU7_PROC", temps),
        "hddTemp": sensor_with_health("HDD_TEMP", temps),
        "pdbTemp1": sensor_with_health("PDB_TEMP1", temps),
        "pdbTemp2": sensor_with_health("PDB_TEMP2", temps),
    });

    let fan_speed = serde_json::json!({
        "gpuFan12": sensor_with_health("GPU_FAN12", fans),
        "gpuFan56": sensor_with_health("GPU_FAN56", fans),
        "sysFan1": sensor_with_health("SYS_FAN1", fans),
        "sysFan2": sensor_with_health("SYS_FAN2", fans),
        "gpuFan34": sensor_with_health("GPU_FAN34", fans),
        "gpuFan78": sensor_with_health("GPU_FAN78", fans),
        "gpuFan12E": sensor_with_health("GPU_FAN12E", fans),
        "gpuFan56E": sensor_with_health("GPU_FAN56E", fans),
    });

    let voltage = serde_json::json!({
        "cpu0Vcore": sensor_with_health("P0_VDDCR_CPU", volts),
        "cpu0Vccin": sensor_with_health("P0_VDD_18", volts),
        "dimmG0Volt": sensor_with_health("VR_DIMMG0_VOUT", volts),
        "dimmG1Volt": sensor_with_health("VR_DIMMG1_VOUT", volts),
        "volt12v": sensor_with_health("P_12V", volts),
        "volt5v": sensor_with_health("P_5V", volts),
        "volt3v3": sensor_with_health("P_3V3", volts),
    });

    let current = serde_json::json!({
        "cpu0Current": sensor_with_health("VR_P0_IOUT", volts),
        "dimmG0Current": sensor_with_health("VR_DIMMG0_IOUT", volts),
        "dimmG1Current": sensor_with_health("VR_DIMMG1_IOUT", volts),
        "gpu0Current": sensor_with_health("12V_GPU0", volts),
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

    let aggregate_health = serde_json::json!({
        "level": sensor_cache.aggregate_health.level,
        "reasons": sensor_cache.aggregate_health.reasons,
    });

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
        aggregate_health,
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
        status: STATUS_OFFLINE.to_string(),
        last_seen: chrono::Utc::now().to_rfc3339(),
        uptime: 0,
        host_power_on: false,
        aggregate_health: serde_json::json!({"level": "normal", "reasons": []}),
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
