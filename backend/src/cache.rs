use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SensorHealthLevel {
    Normal,
    Warning,
    Critical,
}

impl SensorHealthLevel {
    pub fn from_redfish(health: &str) -> Self {
        match health {
            "OK" | "ok" => SensorHealthLevel::Normal,
            "Warning" | "warning" => SensorHealthLevel::Warning,
            "Critical" | "critical" => SensorHealthLevel::Critical,
            _ => SensorHealthLevel::Normal,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BmcAggregateHealth {
    pub level: SensorHealthLevel,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub name: String,
    pub value: Option<f64>,
    pub units: Option<String>,
    pub health: Option<String>,
    pub state: Option<String>,
}

impl SensorReading {
    pub fn health_level(&self) -> SensorHealthLevel {
        self.health.as_deref().map(SensorHealthLevel::from_redfish).unwrap_or(SensorHealthLevel::Normal)
    }
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
    pub aggregate_health: BmcAggregateHealth,
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
            aggregate_health: BmcAggregateHealth {
                level: SensorHealthLevel::Normal,
                reasons: vec![],
            },
        }
    }

    pub fn compute_aggregate_health(&mut self) {
        let mut reasons: Vec<String> = vec![];
        let mut worst = SensorHealthLevel::Normal;

        let mut check = |name: &str, level: SensorHealthLevel| {
            if level > SensorHealthLevel::Normal {
                if level > worst { worst = level; }
                let label = match level {
                    SensorHealthLevel::Warning => "警告",
                    SensorHealthLevel::Critical => "严重",
                    SensorHealthLevel::Normal => unreachable!(),
                };
                reasons.push(format!("{} 健康状态: {}", name, label));
            }
        };

        for t in &self.temperatures {
            check(&t.name, t.health_level());
        }
        for f in &self.fans {
            check(&f.name, f.health_level());
        }
        for v in &self.voltages {
            check(&v.name, v.health_level());
        }
        for pc in &self.power_controls {
            check(&pc.name, SensorHealthLevel::from_redfish(&pc.health));
        }
        for ps in &self.power_supplies {
            check(&ps.name, SensorHealthLevel::from_redfish(&ps.health));
        }

        self.aggregate_health = BmcAggregateHealth { level: worst, reasons };
    }
}

#[derive(Debug, Clone)]
pub struct BmcStatusCache {
    pub bmc_reachable: bool,        // BMC Redfish session 是否正常
    pub consecutive_failures: u32,
    pub host_power_on: bool,         // 主机真实电源状态 (来自 Systems/Self PowerState)
    pub host_power_on_since: u64,    // 主机上次开机的时间戳 (now_secs)
    pub host_uptime_accumulated: u64, // 关机时累计的运行时间
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
