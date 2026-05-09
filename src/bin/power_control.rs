use bmc_demo::power_control::run;

#[tokio::main]
async fn main() {
    // 从命令行参数读取动作：on / off / force-off / force-restart
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 2 {
        eprintln!("用法: power_control <on|off|force-off|force-restart>");
        std::process::exit(1);
    }

    let action = &args[1];
    if let Err(e) = run(action).await {
        eprintln!("发生错误: {:#}", e);
        std::process::exit(1);
    }
}

