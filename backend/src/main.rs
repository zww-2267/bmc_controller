mod config;
mod cache;
mod redfish;
mod handlers;

use anyhow::Result;
use axum::{
    body::Body,
    http::{header, Request, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post, delete},
    Router,
};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use tokio::time::{sleep, Duration};

use crate::cache::*;
use crate::config::*;
use crate::handlers::AppState;

const CONFIG_PATH: &str = "config/bmcs.json";

async fn serve_frontend(req: Request<Body>) -> Response {
    let req_path = req.uri().path().trim_start_matches('/');
    let file = Path::new("static").join(if req_path.is_empty() { "index.html" } else { req_path });

    // Static asset with file extension → serve directly
    if file.extension().is_some() && file.exists() {
        let content = std::fs::read(&file).unwrap_or_default();
        let ct = match file.extension().and_then(|e| e.to_str()) {
            Some("html") => "text/html; charset=utf-8",
            Some("js") => "application/javascript; charset=utf-8",
            Some("css") => "text/css; charset=utf-8",
            Some("json") => "application/json",
            Some("png") => "image/png",
            Some("svg") => "image/svg+xml",
            Some("ico") => "image/x-icon",
            Some("woff2") => "font/woff2",
            _ => "application/octet-stream",
        };
        return ([(header::CONTENT_TYPE, ct)], content).into_response();
    }

    // SPA fallback → index.html
    match std::fs::read_to_string("static/index.html") {
        Ok(html) => Html(html).into_response(),
        Err(_) => (
            StatusCode::NOT_FOUND,
            "Frontend not built — missing static/index.html",
        ).into_response(),
    }
}

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
        .with_state(state)
        .fallback(serve_frontend);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);
    println!("[*] Backend server listening on http://0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
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
                            bmc_reachable: true,
                            consecutive_failures: 0,
                            host_power_on: false,
                            host_power_on_since: 0,
                            host_uptime_accumulated: 0,
                        });
                    }
                    Err(e) => {
                        eprintln!("[{}] 创建 session 失败: {}", bmc_id, e);
                        continue;
                    }
                }
            }

            let session = {
                let sessions_guard = state.sessions.read();
                match sessions_guard.get(bmc_id) {
                    Some(s) => s.clone(),
                    None => continue,
                }
            };

            let thermal_result = redfish::poll_thermal(&session).await;
            let power_result = redfish::poll_power(&session).await;
            let system_result = redfish::poll_system(&session, ip).await;

            let mut cache = state.cache.write();
            let SensorCache { sensors, statuses } = &mut *cache;
            let sensor_cache = sensors.entry(bmc_id.clone()).or_insert_with(BmcSensorCache::new);
            let status_cache = statuses.entry(bmc_id.clone()).or_insert_with(|| BmcStatusCache {
                bmc_reachable: true,
                consecutive_failures: 0,
                host_power_on: false,
                host_power_on_since: 0,
                host_uptime_accumulated: 0,
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

            if let Ok((power_state, _uptime_secs)) = system_result {
                let was_on = status_cache.host_power_on;
                let now_on = power_state == "On";

                if now_on && !was_on {
                    status_cache.host_power_on_since = now_secs();
                } else if !now_on && was_on {
                    let session_uptime = now_secs().saturating_sub(status_cache.host_power_on_since);
                    status_cache.host_uptime_accumulated = status_cache.host_uptime_accumulated.saturating_add(session_uptime);
                }
                status_cache.host_power_on = now_on;
            }

            if thermal_ok || power_ok {
                status_cache.consecutive_failures = 0;
                status_cache.bmc_reachable = true;
            } else {
                status_cache.consecutive_failures += 1;
                if status_cache.consecutive_failures >= 3 {
                    status_cache.bmc_reachable = false;
                }
            }

            sensor_cache.compute_aggregate_health();
            sensor_cache.last_updated = now_secs();
        }

        sleep(Duration::from_secs(10)).await;
    }
}
