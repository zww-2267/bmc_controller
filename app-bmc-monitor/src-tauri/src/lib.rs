use std::net::{TcpListener, TcpStream};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

struct BackendProcess(Mutex<Option<Child>>);

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .map(|l| l.local_addr().unwrap().port())
        .unwrap_or(3001)
}

fn wait_for_backend(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let port = find_free_port();

            let resource_dir = app.path().resource_dir()
                .expect("failed to resolve resource_dir");
            let backend_name = if cfg!(target_os = "windows") {
                format!("{}-backend.exe", env!("CARGO_PKG_NAME"))
            } else {
                format!("{}-backend", env!("CARGO_PKG_NAME"))
            };
            let backend_path = resource_dir.join(backend_name);

            let mut child = Command::new(&backend_path)
                .env("PORT", port.to_string())
                .spawn()
                .expect("Failed to start bmc-backend sidecar");

            if !wait_for_backend(port, Duration::from_secs(10)) {
                let _ = child.kill();
                panic!("Backend health check timeout on port {}", port);
            }

            app.manage(BackendProcess(Mutex::new(Some(child))));

            let main_window = app.get_webview_window("main")
                .expect("main window not found");
            let _ = main_window.eval(
                &format!("window.__BACKEND_PORT__ = {};", port)
            );

            Ok(())
        })
        .on_window_event(|window, event| {
            use tauri::WindowEvent;
            if let WindowEvent::Destroyed = event {
                if let Some(mut child) = window
                    .state::<BackendProcess>()
                    .0.lock().unwrap().take()
                {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
