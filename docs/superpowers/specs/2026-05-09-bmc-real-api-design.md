# BMC 真实数据 API 对接 — 设计文档

## 目标

将三应用拆分的前端从 mock 数据切换到真实 BMC 数据。构建 Rust HTTP 后端服务（axum），封装 Redfish 协议，前端通过 REST API 获取实时 BMC 传感器数据、控制电源。

## 架构

```
前端 (Vite) ──HTTP──> Rust Server (axum, port 3001) ──Redfish──> BMC 192.168.2.101
```

- 单体 Rust HTTP server，3 个前端共用一个后端
- 后端启动时建立 Redfish session，定时轮询缓存传感器数据
- BMC 凭据和路由器信息持久化在 JSON 配置文件
- 前端保留 mock 数据框架但默认使用真实 API

## 后端 API

### Rust 项目结构

```
backend/
├── Cargo.toml          # axum + tokio + reqwest + serde_json + base64
├── config/
│   └── bmcs.json        # 路由器和 BMC 设备持久化配置
├── src/
│   ├── main.rs           # axum HTTP server 入口，路由注册
│   ├── redfish.rs        # Redfish 客户端：login, thermal, power, reset
│   ├── cache.rs           # 传感器数据缓存 (tokio::sync::RwLock<SensorData>)
│   ├── config.rs          # 配置文件读写 (bmcs.json)
│   └── handlers.rs        # axum handler 函数
```

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 验证前端登录凭据 (admin/abc123..) |
| `GET` | `/api/routers` | 返回路由器列表 |
| `GET` | `/api/bmcs?routerId=xxx` | 指定路由器下的 BMC 列表 |
| `GET` | `/api/bmcs/:id/status` | BMC 在线状态 + uptime |
| `GET` | `/api/bmcs/:id/sensors` | 聚合传感器数据 (温度/风扇/电压/Power/PSU) |
| `POST` | `/api/bmcs/:id/power/on` | 开机 (body: `{ "rootPassword": "123456" }`) |
| `POST` | `/api/bmcs/:id/power/off` | 关机 |
| `POST` | `/api/bmcs/:id/power/restart` | 重启 |
| `POST` | `/api/bmcs` | 添加 BMC 到配置文件 |
| `DELETE` | `/api/bmcs/:id` | 从配置文件删除 BMC |

### 传感器缓存策略

- 后端启动后每 10s 轮询一次 Redfish `/Thermal` 和 `/Power`
- 数据缓存于内存 `RwLock<SensorCache>`
- 前端请求 `/api/bmcs/:id/sensors` 直接返回缓存数据（低延迟）
- BMC status：session 有效 → `online`；Redfish 请求失败 3 次 → `offline`
- uptime：后端记录首次连接成功时间戳

### 配置文件

`config/bmcs.json`：
```json
{
  "routers": [
    {
      "id": "router-1",
      "name": "核心路由器1",
      "location": "主数据中心",
      "bmcs": [
        {
          "id": "bmc-real-1",
          "ip": "192.168.2.101",
          "username": "admin",
          "password": "abc123.."
        }
      ]
    }
  ]
}
```

## 前端变更

### 共享层 (`shared/`)

| 文件 | 变更 |
|------|------|
| `shared/api/client.ts` | 移除 mock 延时/克隆，改用 `axios` 调用 `http://localhost:3001` |
| `shared/api/bmc.ts` | `fetchBMCsByRouter` → `GET /api/bmcs?routerId=`，`createBMC` → `POST /api/bmcs`，`deleteBMC` → `DELETE /api/bmcs/:id` |
| `shared/api/routers.ts` | `fetchRouters` → `GET /api/routers` |
| `shared/api/sensors.ts` | 新增 `fetchBMCSensors(id)` → `GET /api/bmcs/:id/sensors`，`fetchBMCStatus(id)` → `GET /api/bmcs/:id/status` |
| `shared/mocks/` | 保留不动 |
| `shared/hooks/` | 不动（API 签名兼容） |
| `shared/stores/rootStore.ts` | `unlock` 改为调用 `POST /api/auth/login` 验证前端凭据 |
| `shared/types/index.ts` | 按 Redfish 字段调整 `SensorData` 类型 |

### App1 (路由器管理)

- 真实 BMC 增删按钮有效（调用 POST/DELETE API）
- 移除 "添加 BMC" 中的密码字段（BMC 凭据由后端配置管理）
- 面包屑 / 标题从配置文件读取

### App2 (BMC 详情)

- 传感器数据从缓存读取（5s 轮询间隔）
- 开关机按钮：POST 请求体携带 `rootPassword`，后端验证后执行
- 登录页：凭据改为 `admin:abc123..`（前端 Basic Auth 到后端）

### App3 (BMC 监控与分析)

- 异常分析：使用真实传感器阈值判定
- BMC 查询：从后端获取真实 BMC 列表
- 日志分析：暂时保留 mock 示例日志

## 实施顺序

1. 创建 Rust backend 项目（axum + Redfish client + 配置文件）
2. 实现 Redfish 采集 + 缓存
3. 实现所有 REST API 端点
4. 修改前端 `shared/api/` 对接真实 API
5. 验证三个前端应用 + 后端联合运行
6. 配置 CORS，dev server proxy

## 技术栈

**后端**: Rust + axum 0.8 + tokio + reqwest + serde_json + base64 + anyhow
**前端**: 现有 React 19 + TypeScript 6 + axios
