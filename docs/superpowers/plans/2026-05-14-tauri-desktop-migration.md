# Tauri Desktop Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 app-bmc-detail、app-bmc-monitor、app-router-manager 从浏览器 Web 应用转换为独立 Tauri 2.11 桌面应用，后端以 sidecar 子进程运行，前端通过 localhost HTTP 通信。

**Architecture:** 每个应用新增 `src-tauri/` 目录（Rust sidecar 管理层），`externalBin` 声明后端二进制，`setup` hook 中分配端口→spawn 后端→TCP health check→`window.eval()` 注入端口。前端仅改 `BrowserRouter→HashRouter` 和 `api/client.ts` 动态端口。

**Tech Stack:** Tauri 2.11, Rust, React 19, TypeScript 6, Vite

---

### Task 1: 创建共享资源 — src-tauri 骨架

为三个 app 创建相同的 `src-tauri/` 骨架目录结构。文件内容除 app 名称/端口外完全相同。

**Files:**
- Create: `app-bmc-detail/src-tauri/Cargo.toml`
- Create: `app-bmc-detail/src-tauri/build.rs`
- Create: `app-bmc-detail/src-tauri/capabilities/default.json`
- Create: `app-bmc-detail/src-tauri/icons/` (symlink or copy)
- Create: `app-bmc-detail/src-tauri/binaries/.gitkeep`
- Create: `app-bmc-monitor/src-tauri/` (同上结构)
- Create: `app-router-manager/src-tauri/` (同上结构)

- [ ] **Step 1: Create directory structure for all three apps**

```bash
for app in app-bmc-detail app-bmc-monitor app-router-manager; do
  mkdir -p /home/zww/pro/testapi/$app/src-tauri/{src,capabilities,icons,binaries}
done
```

- [ ] **Step 2: Create Cargo.toml for each app**

Write `app-bmc-detail/src-tauri/Cargo.toml`:

```toml
[package]
name = "bmc-detail"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
```

Write `app-bmc-monitor/src-tauri/Cargo.toml` — same, `name = "bmc-monitor"`.

Write `app-router-manager/src-tauri/Cargo.toml` — same, `name = "bmc-router"`.

- [ ] **Step 3: Create build.rs for each app**

All three identical:

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4: Create capabilities/default.json for each app**

All three identical:

```json
{
    "$schema": "../gen/schemas/desktop-schema.json",
    "identifier": "default",
    "description": "enables the default permissions",
    "windows": ["main"],
    "permissions": [
        "core:default",
        "shell:allow-open"
    ]
}
```

- [ ] **Step 5: Copy icons from bmc-manager**

```bash
for app in app-bmc-detail app-bmc-monitor app-router-manager; do
  cp /home/zww/pro/testapi/bmc-manager/src-tauri/icons/* \
     /home/zww/pro/testapi/$app/src-tauri/icons/
done
```

- [ ] **Step 6: Create binaries/.gitkeep**

```bash
for app in app-bmc-detail app-bmc-monitor app-router-manager; do
  touch /home/zww/pro/testapi/$app/src-tauri/binaries/.gitkeep
done
```

- [ ] **Step 7: Commit skeleton**

```bash
git add app-bmc-detail/src-tauri/ app-bmc-monitor/src-tauri/ app-router-manager/src-tauri/
git commit -m "feat: add src-tauri/ skeleton for three desktop apps"
```

---

### Task 2: Tauri Rust Shell — lib.rs (sidecar management)

每个 app 的 `src-tauri/src/lib.rs` 实现：端口分配 → sidecar 启动 → TCP health check → window 端口注入 → window destroy 时 kill 子进程。

**Files:**
- Create: `app-bmc-detail/src-tauri/src/lib.rs`
- Create: `app-bmc-monitor/src-tauri/src/lib.rs`
- Create: `app-router-manager/src-tauri/src/lib.rs`

- [ ] **Step 1: Write lib.rs for all three apps**

All three identical — shared sidecar management logic with no app-specific hardcoding:

```rust
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

- [ ] **Step 2: Verify Rust compiles for each app**

```bash
cd /home/zww/pro/testapi/app-bmc-detail/src-tauri && cargo check 2>&1 | tail -3
cd /home/zww/pro/testapi/app-bmc-monitor/src-tauri && cargo check 2>&1 | tail -3
cd /home/zww/pro/testapi/app-router-manager/src-tauri && cargo check 2>&1 | tail -3
```
Expected: `Checking bmc-xxx v0.1.0 ... Finished` for all three.

- [ ] **Step 3: Commit**

```bash
git add app-bmc-detail/src-tauri/src/lib.rs \
        app-bmc-monitor/src-tauri/src/lib.rs \
        app-router-manager/src-tauri/src/lib.rs
git commit -m "feat: add Tauri sidecar management lib.rs"
```

---

### Task 3: Tauri Config — tauri.conf.json

每个 app 创建 `tauri.conf.json`，配置 externalBin sidecar、窗口标题、frontendDist 路径。

**Files:**
- Create: `app-bmc-detail/src-tauri/tauri.conf.json`
- Create: `app-bmc-monitor/src-tauri/tauri.conf.json`
- Create: `app-router-manager/src-tauri/tauri.conf.json`

- [ ] **Step 1: Write app-router-manager tauri.conf.json**

```json
{
    "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
    "productName": "BMC Router Manager",
    "version": "0.2.0",
    "identifier": "com.bmc.router",
    "build": {
        "frontendDist": "../dist",
        "devUrl": "http://localhost:5173",
        "beforeDevCommand": "npm run dev",
        "beforeBuildCommand": "npm run build"
    },
    "app": {
        "windows": [
            {
                "title": "BMC 路由器管理",
                "width": 1280,
                "height": 800,
                "minWidth": 1024,
                "minHeight": 680,
                "resizable": true,
                "center": true
            }
        ],
        "security": {
            "csp": null
        }
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

- [ ] **Step 2: Write app-bmc-detail tauri.conf.json**

Same as router-manager, with:
```json
"productName": "BMC Detail Manager",
"identifier": "com.bmc.detail",
"devUrl": "http://localhost:5174",
"windows": [{ "title": "BMC 详情管理", ... }]
```

- [ ] **Step 3: Write app-bmc-monitor tauri.conf.json**

Same as router-manager, with:
```json
"productName": "BMC Monitor",
"identifier": "com.bmc.monitor",
"devUrl": "http://localhost:5175",
"windows": [{ "title": "BMC 监控分析", ... }]
```

- [ ] **Step 4: Commit**

```bash
git add app-*/src-tauri/tauri.conf.json
git commit -m "feat: add tauri.conf.json with externalBin sidecar config"
```

---

### Task 4: 修改 shared/api/client.ts — 动态端口

使 API baseURL 从 Tauri 注入的 `window.__BACKEND_PORT__` 读取，fallback 到 3001（浏览器开发模式）。

**Files:**
- Modify: `shared/api/client.ts:1-9`

- [ ] **Step 1: Update client.ts**

```typescript
import axios from 'axios';

const port = (typeof window !== 'undefined' && (window as any).__BACKEND_PORT__)
  ? (window as any).__BACKEND_PORT__
  : 3001;

const api = axios.create({
  baseURL: `http://127.0.0.1:${port}/api`,
  timeout: 10_000,
});

export default api;
```

- [ ] **Step 2: Verify shared types compile**

```bash
cd /home/zww/pro/testapi && npx tsc --noEmit -p app-bmc-detail/tsconfig.json 2>&1 | head -5
```
Expected: clean exit, no errors in shared/api/client.ts.

- [ ] **Step 3: Commit**

```bash
git add shared/api/client.ts
git commit -m "feat: dynamic API port via window.__BACKEND_PORT__ with fallback"
```

---

### Task 5: 修改 App.tsx — BrowserRouter → HashRouter

**Files:**
- Modify: `app-bmc-detail/src/App.tsx:1,18-20`
- Modify: `app-bmc-monitor/src/App.tsx:1,18-20`
- Modify: `app-router-manager/src/App.tsx:1,18-20`

- [ ] **Step 1: Update app-bmc-detail/src/App.tsx**

Change import:
```diff
- import { BrowserRouter, Routes, Route } from 'react-router-dom';
+ import { HashRouter, Routes, Route } from 'react-router-dom';
```

Change JSX:
```diff
- <BrowserRouter>
+ <HashRouter>
    <Routes>
      ...
    </Routes>
- </BrowserRouter>
+ </HashRouter>
```

- [ ] **Step 2: Update app-bmc-monitor/src/App.tsx** — same change.

- [ ] **Step 3: Update app-router-manager/src/App.tsx** — same change.

- [ ] **Step 4: Verify builds**

```bash
cd /home/zww/pro/testapi/app-bmc-detail && npx vite build 2>&1 | tail -3
cd /home/zww/pro/testapi/app-bmc-monitor && npx vite build 2>&1 | tail -3
cd /home/zww/pro/testapi/app-router-manager && npx vite build 2>&1 | tail -3
```
Expected: `✓ built in X.XXs` for all three.

- [ ] **Step 5: Commit**

```bash
git add app-bmc-detail/src/App.tsx app-bmc-monitor/src/App.tsx app-router-manager/src/App.tsx
git commit -m "feat: BrowserRouter → HashRouter for Tauri WebView compat"
```

---

### Task 6: 修改 package.json — 添加 Tauri 依赖

**Files:**
- Modify: `app-bmc-detail/package.json`
- Modify: `app-bmc-monitor/package.json`
- Modify: `app-router-manager/package.json`

- [ ] **Step 1: Update app-bmc-detail/package.json**

Add to `dependencies`:
```json
"@tauri-apps/api": "^2",
"@tauri-apps/plugin-shell": "^2"
```

Add to `scripts`:
```json
"tauri:dev": "tauri dev",
"tauri:build": "tauri build"
```

- [ ] **Step 2: Same for app-bmc-monitor/package.json and app-router-manager/package.json**

- [ ] **Step 3: Install dependencies**

```bash
cd /home/zww/pro/testapi/app-bmc-detail && npm install 2>&1 | tail -3
cd /home/zww/pro/testapi/app-bmc-monitor && npm install 2>&1 | tail -3
cd /home/zww/pro/testapi/app-router-manager && npm install 2>&1 | tail -3
```
Expected: packages added, no errors.

- [ ] **Step 4: Commit**

```bash
git add app-*/package.json app-*/package-lock.json
git commit -m "feat: add Tauri CLI and API deps to package.json"
```

---

### Task 7: 构建后端 binary 并拷贝到 sidecar 目录

**Files:**
- Create: `app-bmc-detail/src-tauri/binaries/bmc-backend`
- Create: `app-bmc-monitor/src-tauri/binaries/bmc-backend`
- Create: `app-router-manager/src-tauri/binaries/bmc-backend`

- [ ] **Step 1: Build backend binary**

```bash
cd /home/zww/pro/testapi/backend && cargo build --release 2>&1 | tail -3
```
Expected: `Finished release [optimized] target(s)`.

- [ ] **Step 2: Copy to each app's sidecar directory**

```bash
for app in app-bmc-detail app-bmc-monitor app-router-manager; do
  cp /home/zww/pro/testapi/backend/target/release/bmc-backend \
     /home/zww/pro/testapi/$app/src-tauri/binaries/bmc-backend
done
```

- [ ] **Step 3: Verify Tauri Rust compilation includes sidecar**

```bash
cd /home/zww/pro/testapi/app-bmc-detail/src-tauri && cargo check 2>&1 | tail -1
```
Expected: `Finished`.

---

### Task 8: Tauri 完整构建验证

- [ ] **Step 1: Build app-bmc-detail Tauri**

```bash
cd /home/zww/pro/testapi/app-bmc-detail && npx tauri build 2>&1 | tail -10
```
Expected: `.deb` and `.AppImage` in `src-tauri/target/release/bundle/`.

- [ ] **Step 2: Verify bundle output**

```bash
ls -lh /home/zww/pro/testapi/app-bmc-detail/src-tauri/target/release/bundle/deb/
ls -lh /home/zww/pro/testapi/app-bmc-detail/src-tauri/target/release/bundle/appimage/
```
Expected: `.deb` file present, `.AppImage` file present.

- [ ] **Step 3: Quick smoke test — install and launch**

```bash
sudo dpkg -i /home/zww/pro/testapi/app-bmc-detail/src-tauri/target/release/bundle/deb/bmc-detail_*.deb
# Launch from app menu or terminal: bmc-detail
# Verify: window opens, backend starts, API data loads
```

- [ ] **Step 4: Build remaining two apps**

```bash
cd /home/zww/pro/testapi/app-bmc-monitor && npx tauri build --bundles deb 2>&1 | tail -5
cd /home/zww/pro/testapi/app-router-manager && npx tauri build --bundles deb 2>&1 | tail -5
```

- [ ] **Step 5: Commit final state**

```bash
git add -A && git commit -m "build: desktop apps with Tauri sidecar — all three verified"
```
