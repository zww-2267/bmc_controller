use anyhow::{Context, Result};
use base64::Engine;
use reqwest::{header, Client, StatusCode};
use serde_json::json;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, Duration};

// 声明 lib 里的模块（如果 crate 结构不同，请按实际修改）
use bmc_demo::power_control;

// ==========================================
// 👇 你的 BMC 信息 👇
// ==========================================
const BMC_IP: &str = "192.168.2.101";
const BMC_USER: &str = "admin";
const BMC_PASS: &str = "abc123..";
// ==========================================

// 【可选】只显示“运行关键”指标的白名单（名字后缀，大写匹配）
// 留空则显示全部；建议先用空跑全量确认，再逐条加上你关心的名字。
const CRITICAL_ONLY: bool = true;
const CRITICAL_SUFFIXES: &[&str] = &[
    // 温度
    "CPU0_TEMP",
    "CPU0_DTS",
    "DIMMG0_TEMP",
    "DIMMG1_TEMP",
    "MB_TEMP1",
    "MB_TEMP2",
    "INLET_AIR_TEMP",
    "NVMeG0_TEMP",
    "M2_G0_AMB_TEMP",
    "HDD_TEMP",
    "PDB_TEMP1",
    "PDB_TEMP2",
    "VR_P0_TEMP",
    "VR_DIMMG0_TEMP",
    "VR_DIMMG1_TEMP",
    // GPU 温度（根据实际 GPU 数量保留需要的）
    "GPU0_PROC",
    "GPU1_PROC",
    "GPU2_PROC",
    "GPU3_PROC",
    "GPU4_PROC",
    "GPU5_PROC",
    "GPU6_PROC",
    "GPU7_PROC",
    // 风扇
    "SYS_FAN1",
    "SYS_FAN2",
    "GPU_FAN12",
    "GPU_FAN34",
    "GPU_FAN56",
    "GPU_FAN78",
    "GPU_FAN12E",
    "GPU_FAN56E",
    // 基础电压
    "P_12V",
    "P_5V",
    "P_3V3",
    "P_5V_STBY",
    // SoC/主板/CMOS 电压
    "SOC_VDDCR",
    "SOC_VDDCR_DUAL",
    "P_VBAT",
    // CPU 核心/IO 电压
    "P0_VDDCR_CPU",
    "P0_VDDIO_ABCD",
    "P0_VDDIO_EFGH",
    "P0_VPP_ABCD_SUS",
    "P0_VPP_EFGH_SUS",
    "P0_VDD_18_DUAL",
    "P0_VDD_18",
    "P_1V2",
    // VRM 输入/输出
    "VR_P0_VIN",
    "VR_P0_VOUT",
    "VR_DIMMG0_VIN",
    "VR_DIMMG0_VOUT",
    "VR_DIMMG1_VIN",
    "VR_DIMMG1_VOUT",
    // 12V 各路分支（根据你的硬件配置删减不需要的 GPU 0~7）
    "12V_RISER1",
    "12V_RISER2",
    "12V_GPU0",
    "12V_GPU1",
    "12V_GPU2",
    "12V_GPU3",
    "12V_GPU4",
    "12V_GPU5",
    "12V_GPU6",
    "12V_GPU7",
    "12V_ATX1",
    "12V_ATX2",
    "12V_MB",
    "12V_PDB",
    "12V_FAN",
    // 电流
    "VR_P0_IOUT",
    "VR_DIMMG0_IOUT",
    "VR_DIMMG1_IOUT",
];

fn is_critical(name: &str) -> bool {
    if !CRITICAL_ONLY {
        return true;
    }
    let upper = name.to_uppercase();
    CRITICAL_SUFFIXES.iter().any(|&s| upper.ends_with(s))
}

#[tokio::main]
async fn main() -> Result<()> {
    let base_url = format!("https://{}/redfish/v1", BMC_IP);

    // 构建忽略证书错误的客户端
    let client = Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .context("构建 HTTP 客户端失败")?;

    println!("[*] 正在连接 BMC {} ...", BMC_IP);

    // --- 1. 登录获取 Token ---
    let login_url = format!("{}/SessionService/Sessions", base_url);
    let auth_str = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", BMC_USER, BMC_PASS))
    );
    let login_body = json!({"UserName": BMC_USER, "Password": BMC_PASS});

    let resp = client
        .post(&login_url)
        .header(header::AUTHORIZATION, auth_str)
        .json(&login_body)
        .send()
        .await
        .context("登录请求失败")?;

    if resp.status() != StatusCode::CREATED {
        anyhow::bail!("❌ 登录失败: {}", resp.status());
    }

    let token = resp
        .headers()
        .get("X-Auth-Token")
        .and_then(|v| v.to_str().ok())
        .context("未获取到 Token")?
        .to_string();

    let session_loc = resp
        .headers()
        .get("Location")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    println!("[✓] 登录成功！");

    // --- 2. 注册退出时自动注销会话 (防止占用 BMC 会话名额) ---
    struct SessionGuard(Client, String, String);
    impl Drop for SessionGuard {
        fn drop(&mut self) {
            let c = self.0.clone();
            let t = self.1.clone();
            let u = self.2.clone();
            // 异步发送注销请求，不阻塞主线程退出
            tokio::spawn(async move {
                let _ = c.delete(&u).header("X-Auth-Token", &t).send().await;
            });
        }
    }
    let logout_url = if session_loc.starts_with('/') {
        format!("https://{}{}", BMC_IP, session_loc)
    } else {
        session_loc
    };
    let _guard = SessionGuard(client.clone(), token.clone(), logout_url);

    // --- 3. 动态寻找 Chassis 路径 (只需寻找一次) ---
    let chassis_url = format!("{}/Chassis", base_url);
    let chassis_root: Value = client
        .get(&chassis_url)
        .header("X-Auth-Token", &token)
        .send()
        .await?
        .json()
        .await?;

    let chassis_path = chassis_root
        .get("Members")
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.get(0))
        .and_then(|m| m.get("@odata.id"))
        .and_then(|v| v.as_str())
        .context("未找到 Chassis 路径")?;

    let full_chassis_url = format!("https://{}{}", BMC_IP, chassis_path);
    let thermal_url = format!("{}/Thermal", full_chassis_url);
    let power_url = format!("{}/Power", full_chassis_url); // 关键：电压/电源在这里

    // --- 4. 进入定时采集主循环 ---
    println!("[*] 开始每 10 秒定时采集... (按 Ctrl+C 退出)\n");
    let mut count = 0u64;

    loop {
        count += 1;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // ANSI 转义序列：清空屏幕并把光标移到左上角 (实现原地刷新)
        print!("\x1B[2J\x1B[H");

        println!("==================================================");
        println!(" BMC 实时监控面板 | 第 {} 次 | 时间: {}", count, timestamp);
        println!("==================================================\n");

        // 获取温度和风扇（如果单次报错，打印错误，不崩溃退出循环）
        if let Err(e) = get_thermal_and_fans(&client, &token, &thermal_url).await {
            println!("⚠ 获取温控数据失败: {}", e);
        }

        // 获取电压、功耗与电源状态（基于 /Power）
        if let Err(e) = get_power_and_status(&client, &token, &power_url).await {
            println!("⚠ 获取电源/传感器数据失败: {}", e);
        }

        // 休眠 10 秒
        sleep(Duration::from_secs(10)).await;
    }
}

// ==========================================
// 温度 + 风扇（/Thermal）
// ==========================================

/// 获取温度与风扇 (从 /Thermal 接口)
async fn get_thermal_and_fans(client: &Client, token: &str, url: &str) -> Result<()> {
    let body: Value = client
        .get(url)
        .header("X-Auth-Token", token)
        .send()
        .await?
        .json()
        .await?;

    let mut core_temps = Vec::new();
    let mut env_temps = Vec::new();

    if let Some(temps) = body.get("Temperatures").and_then(|v| v.as_array()) {
        for item in temps {
            let name = item.get("Name").and_then(|v| v.as_str()).unwrap_or("Unknown");
            let upper_name = name.to_uppercase();
            let reading = item
                .get("ReadingCelsius")
                .or_else(|| item.get("Reading"))
                .and_then(|v| v.as_f64());
            let status = item
                .get("Status")
                .and_then(|s| s.get("Health"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");

            // 如果设备不存在(Absent)，直接跳过不显示
            if status == "Absent" {
                continue;
            }

            let val_str = match reading {
                Some(v) => format!("{:.1} °C", v),
                None => "N/A".to_string(),
            };

            // 只保留“关键指标”
            if !is_critical(name) {
                continue;
            }

            if upper_name.contains("CPU")
                || upper_name.contains("VR_")
                || upper_name.contains("DIMM")
                || upper_name.contains("MB_")
                || upper_name.contains("INLET")
            {
                core_temps.push(format!("  {:<20} : {:>8} [{}]", name, val_str, status));
            } else {
                env_temps.push(format!("  {:<20} : {:>8} [{}]", name, val_str, status));
            }
        }
    }

    let mut fans = Vec::new();
    if let Some(fan_list) = body.get("Fans").and_then(|v| v.as_array()) {
        for item in fan_list {
            let name = item
                .get("Name")
                .or_else(|| item.get("FanName"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown");
            let reading = item.get("Reading").and_then(|v| v.as_f64());
            let units = item
                .get("ReadingUnits")
                .and_then(|v| v.as_str())
                .unwrap_or("RPM");
            let status = item
                .get("Status")
                .and_then(|s| s.get("Health"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");

            if status == "Absent" {
                continue;
            }

            let val_str = match reading {
                Some(v) => format!("{:.0} {}", v, units),
                None => "N/A".to_string(),
            };

            // 只保留关键风扇
            if !is_critical(name) {
                continue;
            }

            fans.push(format!(
                "  {:<20} : {:>8} [{}]",
                name, val_str, status
            ));
        }
    }

    println!("========== [ 核心温度 (CPU/主板/内存) ] ==========");
    if core_temps.is_empty() {
        println!("  (无数据)")
    } else {
        core_temps.iter().for_each(|s| println!("{}", s));
    }

    println!("\n========== [ 环境温度 (GPU/硬盘/NVMe) ] ==========");
    if env_temps.is_empty() {
        println!("  (无数据)")
    } else {
        env_temps.iter().for_each(|s| println!("{}", s));
    }

    println!("\n========== [ 风扇转速 ] ==========");
    if fans.is_empty() {
        println!("  (无数据)")
    } else {
        fans.iter().for_each(|s| println!("{}", s));
    }

    Ok(())
}

// ==========================================
// 电压/功耗/电源状态（/Power）
// ==========================================

/// 获取电压、电流与状态 (从 /Power 接口)
async fn get_power_and_status(client: &Client, token: &str, url: &str) -> Result<()> {
    let body: Value = client
        .get(url)
        .header("X-Auth-Token", token)
        .send()
        .await?
        .json()
        .await?;

    // ---- 1) Voltages 电压/电流 ----
    let mut core_volts = Vec::new();
    let mut base_volts = Vec::new();
    let mut currents = Vec::new();

    if let Some(voltages) = body.get("Voltages").and_then(|v| v.as_array()) {
        for v in voltages {
            let name = v.get("Name").and_then(|v| v.as_str()).unwrap_or("Unknown");
            let upper_name = name.to_uppercase();

            // 过滤：只保留关键指标
            if !is_critical(name) {
                continue;
            }

            // 只显示“启用”的传感器
            let state = v
                .get("Status")
                .and_then(|s| s.get("State"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown");
            if state.eq_ignore_ascii_case("disabled") {
                continue;
            }

            let health = v
                .get("Status")
                .and_then(|s| s.get("Health"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");

            let reading_volts = v.get("ReadingVolts").and_then(|v| v.as_f64());
            let reading_amps = v.get("ReadingAmps").and_then(|v| v.as_f64());

            // 根据字段名/单位分类（兼容不同 OEM）
            if reading_amps.is_some()
                || upper_name.contains("IOUT")
                || v.get("ReadingUnits")
                    .and_then(|u| u.as_str())
                    .map(|u| u.contains("Amp"))
                    .unwrap_or(false)
            {
                let val = reading_amps
                    .map(|a| format!("{:.2} A", a))
                    .unwrap_or_else(|| "N/A".into());
                currents.push(format!("  {:<20} : {:>8} [{}]", name, val, health));
            } else if reading_volts.is_some() {
                let val = reading_volts
                    .map(|v| format!("{:.3} V", v))
                    .unwrap_or_else(|| "N/A".into());

                // 分类到“核心电压”还是“基础电压”
                if upper_name.starts_with("P_12")
                    || upper_name.starts_with("P_5")
                    || upper_name.starts_with("P_3")
                    || upper_name.starts_with("P_1")
                    || upper_name.starts_with("12V_")
                {
                    base_volts.push(format!("  {:<20} : {:>8} [{}]", name, val, health));
                } else {
                    core_volts.push(format!("  {:<20} : {:>8} [{}]", name, val, health));
                }
            }
        }
    }

    println!("\n========== [ 核心电压 (CPU VRM/内存供电) ] ==========");
    if core_volts.is_empty() {
        println!("  (无数据)")
    } else {
        core_volts.iter().for_each(|s| println!("{}", s));
    }

    println!("\n========== [ 基础电压 (12V/5V/3.3V) ] ==========");
    if base_volts.is_empty() {
        println!("  (无数据)")
    } else {
        base_volts.iter().for_each(|s| println!("{}", s));
    }

    println!("\n========== [ 供电电流 (VRM 负载) ] ==========");
    if currents.is_empty() {
        println!("  (无数据)")
    } else {
        currents.iter().for_each(|s| println!("{}", s));
    }

    // ---- 2) PowerControl (整机功耗 & 电源子系统状态) ----
    let mut power_metrics = Vec::new();

    if let Some(pc_list) = body.get("PowerControl").and_then(|v| v.as_array()) {
        for pc in pc_list {
            let name = pc
                .get("Name")
                .and_then(|v| v.as_str())
                .unwrap_or("PowerControl");
            let consumed = pc
                .get("PowerConsumedWatts")
                .and_then(|v| v.as_f64())
                .map(|w| format!("{:.0} W", w))
                .unwrap_or_else(|| "N/A".into());

            let health = pc
                .get("Status")
                .and_then(|s| s.get("Health"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");

            let state = pc
                .get("Status")
                .and_then(|s| s.get("State"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");

            power_metrics.push(format!(
                "  {:<30} : {:>8}  Health={} State={}",
                name, consumed, health, state
            ));
        }
    }

    println!("\n========== [ 整机功耗与电源控制 ] ==========");
    if power_metrics.is_empty() {
        println!("  (无数据)")
    } else {
        power_metrics.iter().for_each(|s| println!("{}", s));
    }

    // ---- 3) PowerSupplies (单电源信息、状态与输出) ----
    let mut psu_info = Vec::new();

    if let Some(ps_list) = body.get("PowerSupplies").and_then(|v| v.as_array()) {
        for (idx, ps) in ps_list.iter().enumerate() {
            let name = ps
                .get("Name")
                .and_then(|v| v.as_str())
                .unwrap_or("PSU");
            let manufacturer = ps
                .get("Manufacturer")
                .and_then(|v| v.as_str())
                .unwrap_or("-");
            let model = ps.get("Model").and_then(|v| v.as_str()).unwrap_or("-");
            let serial = ps
                .get("SerialNumber")
                .and_then(|v| v.as_str())
                .unwrap_or("-");

            let health = ps
                .get("Status")
                .and_then(|s| s.get("Health"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");
            let state = ps
                .get("Status")
                .and_then(|s| s.get("State"))
                .and_then(|v| v.as_str())
                .unwrap_or("N/A");

            let last_output = ps
                .get("LastPowerOutputWatts")
                .and_then(|v| v.as_f64())
                .map(|w| format!("{:.0} W", w))
                .unwrap_or_else(|| "N/A".into());

            let line_input_voltage = ps
                .get("LineInputVoltage")
                .and_then(|v| v.as_f64())
                .map(|v| format!("{:.1} VAC", v))
                .unwrap_or_else(|| "N/A".into());

            psu_info.push(format!(
                "  PSU{}: {} {} (S/N: {}) | Health={} State={}",
                idx + 1,
                manufacturer,
                model,
                serial,
                health,
                state
            ));
            psu_info.push(format!(
                "    LastOutput={} | LineInput={}",
                last_output, line_input_voltage
            ));
        }
    }

    println!("\n========== [ 电源信息（PSU） ] ==========");
    if psu_info.is_empty() {
        println!("  (无数据)")
    } else {
        psu_info.iter().for_each(|s| println!("{}", s));
    }

    Ok(())
}

