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
