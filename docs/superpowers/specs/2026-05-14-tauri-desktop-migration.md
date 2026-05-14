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
| 后端生命周期 | **externalBin Sidecar** | Tauri 2 原生 sidecar 机制；自动附带 target-triple；exit 时自动清理 |

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
│  │  - setup: 分配端口 + sidecar 启动 │  │
│  │  - TCP health check (无 reqwest)  │  │
│  │  - eval 注入 window.__BACKEND_PORT_│  │
│  │  - on_window_event: kill 子进程   │  │
│  └───────────┬───────────────────────┘  │
│              │ std::process::Command     │
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
// App.tsx
- import { BrowserRouter } from 'react-router-dom';
+ import { HashRouter } from 'react-router-dom';
- <BrowserRouter>
+ <HashRouter>
```
Reason: Tauri WebView 加载 `tauri://localhost` 协议，不支持 history pushState。

### 2. API baseURL: inject port from Tauri
```ts
// shared/api/client.ts
const port = (window as any).__BACKEND_PORT__ || 3001;
const api = axios.create({
  baseURL: `http://127.0.0.1:${port}/api`,
  timeout: 10_000,
});
```
Port 由 Tauri Rust 侧在 setup 阶段通过 `window.eval()` 注入。

### 3. No other changes
- React Query hooks: unchanged
- Components: unchanged
- Auth / Root stores: unchanged
- Ant Design: unchanged

## Tauri Rust Shell (per app, new file)

### `src-tauri/src/lib.rs`

```rust
use std::net::TcpListener;
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

            // externalBin 将 sidecar 二进制打包进资源目录
            // 路径: src-tauri/binaries/bmc-backend (构建前由脚本拷贝)
            let resource_dir = app.path().resource_dir()
                .expect("failed to resolve resource_dir");
            let backend_name = if cfg!(target_os = "windows") {
                "bmc-backend.exe"
            } else {
                "bmc-backend"
            };
            let backend_path = resource_dir.join(backend_name);

            let child = Command::new(&backend_path)
                .env("PORT", port.to_string())
                .spawn()
                .expect("Failed to start bmc-backend sidecar");

            if !wait_for_backend(port, Duration::from_secs(10)) {
                let _ = child.kill();
                panic!("Backend health check timeout on port {}", port);
            }

            app.manage(BackendProcess(Mutex::new(Some(child))));

            // 注入端口到前端
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
                if let Some(child) = window
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
```

### Dependencies (minimal)

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
```

No reqwest dependency — health check 用 `std::net::TcpStream::connect()` 检测端口开放即可，零依赖、无异步/阻塞冲突。

### `src-tauri/tauri.conf.json` — key fields

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
      "width": 1280,
      "height": 800,
      "center": true
    }]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [
      "binaries/bmc-backend"
    ],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

`externalBin` 会让 Tauri 在打包时自动：
- 附带对应 target-triple 的后缀（构建时处理）
- 设置可执行权限（Linux/Mac）
- 将二进制放入 bundle 资源目录

## Build Flow

```
# 1. 编译后端 (Linux/Windows 各自编译)
cd backend
cargo build --release
cross build --release --target x86_64-pc-windows-gnu   # 或 mingw

# 2. 拷贝二进制到各 app 的 sidecar 目录
for app in app-bmc-detail app-bmc-monitor app-router-manager; do
  cp backend/target/release/bmc-backend $app/src-tauri/binaries/bmc-backend
done

# 3. 编译前端 + Tauri 打包
cd app-xxx
npm run build
npx tauri build
# → src-tauri/target/release/bundle/
#   ├── deb/bmc-detail_0.1.0_amd64.deb
#   ├── AppImage/bmc-detail_0.1.0_amd64.AppImage
#   └── msi/bmc-detail_0.1.0_x64.msi
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
    ├── build.rs            (tauri::build)
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    ├── icons/              (复用 bmc-manager 的)
    ├── binaries/           (构建脚本拷贝后端 binary 至此)
    │   └── bmc-backend
    └── src/
        └── lib.rs          (~70 lines, sidecar management)
```

## Files to Modify (per app)

| File | Change |
|------|--------|
| `App.tsx` | `BrowserRouter` → `HashRouter` |
| `shared/api/client.ts` | `baseURL` → dynamic via `window.__BACKEND_PORT__` |
| `package.json` | 新增 `@tauri-apps/cli` + `@tauri-apps/api` 依赖；scripts 添加 `tauri:dev`/`tauri:build` |

## Verification

1. `cd app-xxx/src-tauri && cargo check` — Rust 编译通过
2. `cd app-xxx && npm run tauri:dev` — 窗口打开，后端启动，API 数据加载
3. `cd app-xxx && npm run tauri:build` — 生成 .deb/.AppImage/.msi
4. 安装 .deb 后运行 — 无浏览器依赖，独立窗口启动
