#!/bin/bash
set -e

echo "========================================="
echo "  BMC Manager — 三应用拆分 启动脚本"
echo "========================================="

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Starting App1: 路由器管理 (port 5173)..."
(cd "$ROOT_DIR/app-router-manager" && npm run dev) &
PID1=$!

echo "Starting App2: BMC 详情 (port 5174)..."
(cd "$ROOT_DIR/app-bmc-detail" && npm run dev) &
PID2=$!

echo "Starting App3: BMC 监控与分析 (port 5175)..."
(cd "$ROOT_DIR/app-bmc-monitor" && npm run dev) &
PID3=$!

echo ""
echo "All three apps starting..."
echo "  App1: http://localhost:5173  (路由器管理)"
echo "  App2: http://localhost:5174  (BMC 详情)"
echo "  App3: http://localhost:5175  (BMC 监控与分析)"
echo ""
echo "Press Ctrl+C to stop all apps."

trap "kill $PID1 $PID2 $PID3 2>/dev/null; exit 0" INT TERM
wait
