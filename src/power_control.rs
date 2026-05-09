use base64::Engine; 
use anyhow::{Context, Result};
use reqwest::{header, Client, StatusCode};
use serde_json::json;
use serde_json::Value;

// ==========================================
// 👇 你的 BMC 信息（只在这里改） 👇
// ==========================================
const BMC_IP: &str   = "192.168.2.101";
const BMC_USER: &str = "admin";
const BMC_PASS: &str = "abc123..";
// ==========================================

/// 对外暴露：开机
pub async fn power_on(client: &Client, token: &str, bmc_ip: &str, redfish_base: &str) -> Result<()> {
    reset_with_type(client, token, bmc_ip, redfish_base, "On").await
}

/// 对外暴露：关机（GracefulShutdown = 正常关机；需要支持 OS 配合）
pub async fn power_off(client: &Client, token: &str, bmc_ip: &str, redfish_base: &str) -> Result<()> {
    reset_with_type(client, token, bmc_ip, redfish_base, "GracefulShutdown").await
}

/// 对外暴露：强制关机（不经过 OS）
pub async fn force_off(client: &Client, token: &str, bmc_ip: &str, redfish_base: &str) -> Result<()> {
    reset_with_type(client, token, bmc_ip, redfish_base, "ForceOff").await
}

/// 对外暴露：强制重启（硬重启）
pub async fn force_restart(client: &Client, token: &str, bmc_ip: &str, redfish_base: &str) -> Result<()> {
    reset_with_type(client, token, bmc_ip, redfish_base, "ForceRestart").await
}

// 内部实现：统一调用 ComputerSystem.Reset
async fn reset_with_type(
    client: &Client,
    token: &str,
    bmc_ip: &str,
    redfish_base: &str,
    reset_type: &str, // "On" / "GracefulShutdown" / "ForceOff" / "ForceRestart" 等
) -> Result<()> {
    println!("[*] 准备执行电源动作: {}", reset_type);

    // 1) 动态找 Systems 路径（通常为 /redfish/v1/Systems/Self 或 /redfish/v1/Systems/1）
    let systems_url = format!("{}/Systems", redfish_base);
    let systems_root: Value = client
        .get(&systems_url)
        .header("X-Auth-Token", token)
        .send()
        .await
        .context("请求 Systems 列表失败")?
        .json()
        .await
        .context("解析 Systems 列表失败")?;

    let system_path = systems_root
        .get("Members")
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.get(0))
        .and_then(|m| m.get("@odata.id"))
        .and_then(|v| v.as_str())
        .context("未找到 System 路径，该 BMC 可能不支持标准 Redfish 电源控制")?;

    // 2) 拼标准的 Action URL（Supermicro/HPE/Lenovo 等通用）
    // 参考：/redfish/v1/Systems/1/Actions/ComputerSystem.Reset
    let reset_url = format!(
        "https://{}{}/Actions/ComputerSystem.Reset",
        bmc_ip, system_path
    );

    println!("[*] Reset Action URL: {}", reset_url);

    // 3) 构造请求体
    let body = json!({
        "ResetType": reset_type
    });

    // 4) 发送 POST
    let resp = client
        .post(&reset_url)
        .header("X-Auth-Token", token)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .context("发送电源指令网络失败")?;

    // 5) 处理结果
    // Redfish 通常返回 200 或 204 表示成功；部分设备也可能用 202 Accepted
    if resp.status().is_success() || resp.status().as_u16() == 204 {
        println!("[✓] 电源指令已发送 ({}).", reset_type);
    } else {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        anyhow::bail!(
            "❌ 电源指令发送失败！状态码: {}，响应: {}",
            status,
            err_text
        );
    }

    Ok(())
}

// ========== 下面是「单独运行」的入口（作为可执行示例） ==========

/// 单独运行：登录 -> 执行电源动作 -> 自动注销
/// 用法示例：
///   cargo run --release --bin power_control -- on
///   cargo run --release --bin power_control -- off
///   cargo run --release --bin power_control -- force-off
///   cargo run --release --bin power_control -- force-restart
pub async fn run(action: &str) -> Result<()> {
    let base_url = format!("https://{}/redfish/v1", BMC_IP);
    let client = Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .context("构建 HTTP 客户端失败")?;

    println!("[*] 正在连接 BMC {} ...", BMC_IP);

    // 登录
    let login_url = format!("{}/SessionService/Sessions", base_url);
    let auth_str = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", BMC_USER, BMC_PASS))
    );
    let login_body = json!({
        "UserName": BMC_USER,
        "Password": BMC_PASS
    });

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
        .context("未获取到 X-Auth-Token")?
        .to_string();

    let session_loc = resp
        .headers()
        .get("Location")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    println!("[✓] 登录成功！");

    // 注册自动注销（Drop 时自动 DELETE 会话）
    struct Guard(Client, String, String);
    impl Drop for Guard {
        fn drop(&mut self) {
            let c = self.0.clone();
            let t = self.1.clone();
            let u = self.2.clone();
            tokio::spawn(async move {
                let _ = c.delete(&u).header("X-Auth-Token", &t).send().await;
                println!("[*] 已自动注销 BMC 会话。");
            });
        }
    }

    let logout_url = if session_loc.starts_with('/') {
        format!("https://{}{}", BMC_IP, session_loc)
    } else {
        session_loc
    };

    let _guard = Guard(client.clone(), token.clone(), logout_url);

    // 根据命令行参数选择动作
    let redfish_base = &base_url; // /redfish/v1
    match action {
        "on" => power_on(&client, &token, BMC_IP, redfish_base).await?,
        "off" => power_off(&client, &token, BMC_IP, redfish_base).await?,
        "force-off" => force_off(&client, &token, BMC_IP, redfish_base).await?,
        "force-restart" => force_restart(&client, &token, BMC_IP, redfish_base).await?,
        _ => anyhow::bail!(
            "不支持的电源动作: {}。可选：on / off / force-off / force-restart",
            action
        ),
    }

    Ok(())
}

