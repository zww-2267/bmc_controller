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

use crate::cache::*;
use crate::config::*;
use crate::handlers::AppState;

const CONFIG_PATH: &str = "config/bmcs.json";

#[tokio::main]
async fn main() -> Result<()> {
    let app_config = load_config(CONFIG_PATH)?;
    let config: SharedConfig = Arc::new(parking_lot::RwLock::new(app_config));
    let cache: SharedSensorCache = Arc::new(parking_lot::RwLock::new(SensorCache::new()));
    let sessions: Arc<parking_lot::RwLock<HashMap<String, redfish::RedfishSession>>> =
        Arc::new(parking_lot::RwLock::new(HashMap::new()));

    let state = Arc::new(AppState {
        config: config.clone(),
        cache: cache.clone(),
        sessions: sessions.clone(),
        config_path: CONFIG_PATH.to_string(),
    });

    let poll_state = state.clone();
    tokio::spawn(async move {
        polling_loop(poll_state).await;
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/auth/login", post(handlers::login))
        .route("/api/routers", get(handlers::get_routers))
        .route("/api/bmcs", get(handlers::get_bmcs))
        .route("/api/bmcs/{id}/status", get(handlers::get_bmc_status))
        .route("/api/bmcs/{id}/sensors", get(handlers::get_bmc_sensors))
        .route("/api/bmcs/{id}/power/on", post(handlers::power_on))
        .route("/api/bmcs/{id}/power/off", post(handlers::power_off))
        .route("/api/bmcs/{id}/power/restart", post(handlers::power_restart))
        .route("/api/bmcs", post(handlers::add_bmc))
        .route("/api/bmcs/{id}", delete(handlers::delete_bmc))
        .layer(cors)
        .with_state(state);

    println!("[*] Backend server listening on http://0.0.0.0:3001");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn polling_loop(state: Arc<AppState>) {
    loop {
        let bmcs: Vec<(String, String, String, String)> = {
            let config = state.config.read();
            config.routers.iter()
                .flat_map(|r| r.bmcs.iter().map(move |b| {
                    (b.id.clone(), b.ip.clone(), b.username.clone(), b.password.clone())
                }))
                .collect()
        };

        for (bmc_id, ip, user, pass) in &bmcs {
            // Release write guard before await — parking_lot guards are not Send
            let needs_session = {
                let sessions = state.sessions.read();
                !sessions.contains_key(bmc_id)
            };

            if needs_session {
                match redfish::create_session(ip, user, pass).await {
                    Ok(session) => {
                        let mut sessions = state.sessions.write();
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

            // Clone session so we don't hold the read guard across awaits
            let session = {
                let sessions_guard = state.sessions.read();
                match sessions_guard.get(bmc_id) {
                    Some(s) => s.clone(),
                    None => continue,
                }
            };

            let thermal_result = redfish::poll_thermal(&session).await;
            let power_result = redfish::poll_power(&session).await;

            let mut cache = state.cache.write();
            let SensorCache { sensors, statuses } = &mut *cache;
            let sensor_cache = sensors.entry(bmc_id.clone()).or_insert_with(BmcSensorCache::new);
            let status_cache = statuses.entry(bmc_id.clone()).or_insert_with(|| BmcStatusCache {
                online: true,
                first_seen: now_secs(),
                consecutive_failures: 0,
            });

            let thermal_ok = thermal_result.is_ok();
            let power_ok = power_result.is_ok();

            match thermal_result {
                Ok((temps, fans)) => {
                    sensor_cache.temperatures = temps;
                    sensor_cache.fans = fans;
                }
                Err(e) => {
                    eprintln!("[{}] Thermal 轮询失败: {}", bmc_id, e);
                }
            }

            match power_result {
                Ok((volts, pc, ps)) => {
                    sensor_cache.voltages = volts;
                    sensor_cache.power_controls = pc;
                    sensor_cache.power_supplies = ps;
                }
                Err(e) => {
                    eprintln!("[{}] Power 轮询失败: {}", bmc_id, e);
                }
            }

            if thermal_ok || power_ok {
                status_cache.consecutive_failures = 0;
                status_cache.online = true;
            } else {
                status_cache.consecutive_failures += 1;
                if status_cache.consecutive_failures >= 3 {
                    status_cache.online = false;
                }
            }

            sensor_cache.last_updated = now_secs();
        }

        sleep(Duration::from_secs(10)).await;
    }
}
