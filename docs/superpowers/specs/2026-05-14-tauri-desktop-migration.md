# Web → Tauri Desktop Migration Spec

**Date:** 2026-05-14
**Status:** approved
**Scope:** 将 app-bmc-detail、app-bmc-monitor、app-router-manager 从浏览器 Web 应用重构为独立 Tauri 2.11 桌面应用

## Decisions

| 决策 | 结论 | 理由 |
|------|------|------|
| 桌面框架 | **Tauri 2.11** | 包体积小(5MB vs 150MB)；项目已有 bmc-manager 参考实现 |
| 应用粒度 | **三个独立桌面应用** | 各自独立分发/部署 |
| 通信方式 | **保留 localhost HTTP** | 后端 handlers 零改动；React Query hooks 零改动 |
| 后端生命周期 | **Sidecar 子进程** | 故障隔离；Tauri exit hook 自动清理 |

## Architecture

```
┌─────────────────────────────────────────┐
│              Tauri Window                │
│  ┌───────────────────────────────────┐  │
│  │   React SPA (Vite + Ant Design)   │  │
│  │   HashRouter                       │  │
│  │   axios → http://127.0.0.1:{port} │  │
│  └───────────┬───────────────────────┘  │
│              │                           │
│  ┌───────────▼───────────────────────┐  │
│  │  Tauri Rust Shell (lib.rs)        │  │
│  │  - setup: 分配端口 + spawn 后端   │  │
│  │  - 启动窗口并注入端口给前端       │  │
│  │  - on_window_event: kill 子进程   │  │
│  │  - on_exit: 清理                  │  │
│  └───────────┬───────────────────────┘  │
│              │ spawn (Command::new)      │
│  ┌───────────▼───────────────────────┐  │
│  │  bmc-backend (sidecar 子进程)     │  │
│  │  - axum HTTP server (127.0.0.1)   │  │
│  │  - Redfish 轮询循环               │  │
│  │  - 读写 config/bmcs.json          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Frontend Changes (per app, ~5 lines each)

### 1. Router: BrowserRouter → HashRouter
```
// App.tsx (or LoginPage routing layer)
- import { BrowserRouter } from 'react-router-dom';
+ import { HashRouter } from 'react-router-dom';
- <BrowserRouter>
+ <HashRouter>
```
Reason: Tauri WebView 加载 `tauri://localhost` 协议，不支持 history pushState。

### 2. API baseURL: inject port from Tauri
```
// shared/api/client.ts
- baseURL: 'http://localhost:3001/api',
+ baseURL: `http://127.0.0.1:${(window as any).__BACKEND_PORT__ || 3001}/api`,
```
Port 由 Tauri Rust 侧在 setup 阶段通过 `window.__BACKEND_PORT__` 注入 IPCE 初始化脚本（或 evaluate 注入）。

### 3. No other changes
- React Query hooks: unchanged
- Components: unchanged
- Auth / Root stores: unchanged
- Ant Design: unchanged

## Tauri Rust Shell (per app, new file)

### `src-tauri/src/lib.rs` — ~80 lines

```rust
use std::net::TcpListener;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct BackendProcess(Mutex<Option<Child>>);

fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .map(|l| l.local_addr().unwrap().port())
        .unwrap_or(3001)
}

fn wait_for_health(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if reqwest::blocking::get(format!("http://127.0.0.1:{}/api/routers", port)).is_ok() {
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
            let backend_path = app.path().resource_dir()?
                .join("bmc-backend");

            let child = Command::new(&backend_path)
                .env("PORT", port.to_string())
                .spawn()
                .expect("Failed to start backend");

            if !wait_for_health(port, Duration::from_secs(10)) {
                eprintln!("Backend health check failed");
                let _ = child.kill();
                panic!("Backend startup timeout");
            }

            app.manage(BackendProcess(Mutex::new(Some(child))));
            app.manage(BackendPort(port));

            // Inject port into all webview windows
            let main_window = app.get_webview_window("main").unwrap();
            let _ = main_window.eval(&format!("window.__BACKEND_PORT__ = {}", port));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(proc) = window.state::<BackendProcess>().0.lock().unwrap().take() {
                    let _ = proc.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error running tauri");
}
```

### Dependencies to add
```toml
# Cargo.toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
reqwest = { version = "0.11", features = ["blocking"] }
```

### `tauri.conf.json` — key fields
```json
{
  "productName": "BMC Detail Manager",
  "identifier": "com.bmc.detail",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5174",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{
      "title": "BMC 详情管理",
      "width": 1280, "height": 800,
      "center": true
    }]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "resources": {
      "../backend/target/release/bmc-backend": "bmc-backend"
    }
  }
}
```

Note: `resources` maps the backend binary into Tauri's resource directory. On Windows, append `.exe` to the value. The `externalBin` field (deprecated in Tauri 2) is replaced by `resources`.

## Build Flow

```
1. cd backend && cargo build --release          # 编译后端
2. cd app-xxx && npm run build                   # 编译前端 (tsc + vite)
3. cd app-xxx && npx tauri build                 # Tauri 打包
   → src-tauri/target/release/bundle/
     ├── deb/bmc-detail_0.1.0_amd64.deb
     ├── AppImage/bmc-detail_0.1.0_amd64.AppImage
     └── msi/bmc-detail_0.1.0_x64.msi
```

## Per-App Configuration

| App | Port (dev) | productName | identifier | window title |
|-----|-----------|-------------|------------|--------------|
| app-router-manager | 5173 | BMC Router Manager | com.bmc.router | BMC 路由器管理 |
| app-bmc-detail | 5174 | BMC Detail Manager | com.bmc.detail | BMC 详情管理 |
| app-bmc-monitor | 5175 | BMC Monitor | com.bmc.monitor | BMC 监控分析 |

## Files to Create (per app)

```
app-xxx/
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs          (tauri::build)
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    ├── icons/            (复用 bmc-manager 的)
    └── src/
        └── lib.rs        (~80 lines, sidecar management)
```

## Files to Modify (per app)

| File | Change |
|------|--------|
| `App.tsx` | `BrowserRouter` → `HashRouter` |
| `LoginPage.tsx` | `useNavigate` path prefix (if any) |
| `shared/api/client.ts` | `baseURL` → dynamic via `window.__BACKEND_PORT__` |
| `package.json` | Add `tauri` dependency + scripts (`tauri:dev`, `tauri:build`) |
| (delete) `../../../start-all.sh` references | App no longer needs external start script |

## Verification

1. `cargo build` in each `src-tauri/` — compiles
2. `npm run tauri:dev` — opens window, backend starts, UI loads with real API data
3. `npm run tauri:build` — produces .deb/.AppImage/.msi
4. Install .deb on clean system — app launches with no browser dependency
