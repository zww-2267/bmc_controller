# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 5173, strict port)
npm run build        # tsc -b && vite build (outputs to dist/)
npm run lint         # ESLint v10 flat config
npm run tauri:dev    # Tauri dev window (auto-runs npm run dev)
npm run tauri:build  # Full Tauri desktop build (all bundles)
npx tauri build --bundles deb   # Build deb only
```

No test framework is configured.

## Architecture

**Tech stack**: React 19 + TypeScript 6 + Ant Design 6 + Tauri 2.11 (Rust backend) + ECharts + Zustand + TanStack React Query + React Router 7

### Provider order (App.tsx)

```
QueryClientProvider → ConfigProvider (antd, zh_CN) → AntApp → BrowserRouter → AppLayout → Pages
```

`ConfigProvider` sets `colorPrimary: '#1677ff'`, `borderRadius: 6`, and Chinese locale.

### Routing

All routes use a layout route pattern with `<AppLayout />` providing the shell (dark sider + header + `<Outlet />`):

- `/` → redirects to `/routers`
- `/routers` → `RouterManagement` (select router, view/filter BMC table with status + uptime)
- `/bmc/:bmcId` → `BMCDetail` (sensor values, PSU info, CPU chart, power control buttons)
- `/dashboard` → `Dashboard` (global stats, trends, anomaly table)

**Back navigation**: BMCDetail back button navigates to `/routers` with `routerId` in location state, so RouterManagement restores the previously selected router automatically.

### Data flow (100% mock data)

```
React Query hooks (src/hooks/) → Mock API functions (src/api/) → Mock data generators (src/mocks/)
```

- **Hooks** are thin wrappers around `useQuery`/`useMutation` — they add no business logic
- **API layer** uses `src/api/client.ts` which simulates network delay + deep-clones mock data
- **Mock data**: 1200 BMCs across 6 routers, realistic sensor values (temp/voltage/fan/PSU), uptime for online BMCs
- `axios` is installed but **not yet used** — ready for future backend migration
- Polling: sensor data every 5s, sensor summaries/trends every 10s
- On mutation success, React Query invalidates relevant queries (e.g., `['bmcs']` after create/delete)

### State management

- **Zustand** (`src/stores/uiStore.ts`): Exists but is **dead code** — not imported anywhere. All state currently lives in component-local `useState`.
- **React Query**: All server/mock data state. `refetchOnWindowFocus: true`, `retry: 1`.

### Tauri shell

The Rust backend (`src-tauri/`) is minimal — no custom IPC commands. Only default plugins (shell, log). Custom logic would be added in `src-tauri/src/lib.rs`.

## Key conventions

- **`verbatimModuleSyntax`** is on — all type imports must use `import type { ... }` syntax
- **Types** are centralized in `src/types/index.ts` (single file for all interfaces)
- **CSS**: Minimal global reset in `src/index.css`. Component styling uses inline `style` props or Ant Design token-based theming via `theme.useToken()`
- **Chinese locale**: `zh_CN` applied globally. User-facing strings are in Chinese.
- **No barrel exports**: Each file imports from explicit paths
- **No Tooltip**: Tooltips have been systematically removed from the project due to flickering issues on dense UIs. Information is displayed inline instead.

## Recent UI optimizations (2026-05-08)

### Visual fixes
- Dark sidebar menu selected state: overridden to neutral white bg (`rgba(255,255,255,0.12)`) to eliminate green tint
- Router Card selection: fixed border + boxShadow instead of borderColor toggle to eliminate flicker
- Global CSS transitions unified (Card 0.2s, Table row 0.15s)

### Sensor display redesign
- `SensorGauge.tsx`: rewritten as **SensorValue** — text-based name/value rows instead of circular Progress dashboard gauges
- Color coding: green (< 80°C), yellow (80-95°C), red (≥ 95°C), gray (null/N/A)
- No Tooltips on sensors

### Component changes
- `BMCStatusBadge`: Tooltip removed, lastSeen rendered as inline 11px text
- `SensorGroup`: removed `loading` prop, changed from grid to scrollable list (`maxHeight: 400`), uses SensorValue
- `RouterManagement`: status column widened to 280px, lastSeen merged into status column, **uptime column** added
- `BMCDetail`: IP + status enclosed in bordered emphasis box, **power on/off buttons** added, back button preserves router selection
- `Dashboard`: no changes needed

### Data model
- `BMC` interface: added `uptime: number` (seconds), displayed as "X天 X时 X分"

## File organization

```
src/
  main.tsx / App.tsx    — Entry point, providers, routing
  types/index.ts         — All TypeScript interfaces
  api/                   — Mock API client + CRUD functions
  mocks/                 — Mock data generators
  hooks/                 — React Query wrappers (useBMCList, useBMCSensors, etc.)
  stores/                — Zustand stores (uiStore currently unused)
  pages/                 — RouterManagement, BMCDetail, Dashboard
  components/            — AppLayout, BMCAddForm, BMCStatusBadge, SensorValue (file: SensorGauge.tsx), SensorGroup
src-tauri/               — Tauri Rust shell (lib.rs, main.rs, tauri.conf.json)
docs/
  superpowers/
    specs/               — Design specs
    plans/               — Implementation plans
```
