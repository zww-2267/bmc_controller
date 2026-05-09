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
