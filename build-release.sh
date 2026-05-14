#!/bin/bash
set -euo pipefail

VERSION="V0.2@20260514"
ROOT="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$ROOT/release"
BACKEND_DIR="$ROOT/backend"

# App definitions: name, port
APPS=(
  "app-router-manager:5173"
  "app-bmc-detail:5174"
  "app-bmc-monitor:5175"
)

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

echo "============================================"
echo "  Building Release Packages — $VERSION"
echo "============================================"

# ── Step 1: Build all frontends ──
echo ""
echo "[1/4] Building frontends..."

for app_port in "${APPS[@]}"; do
  app="${app_port%%:*}"
  app_dir="$ROOT/$app"
  echo "  → $app"
  cd "$app_dir"
  npx vite build --logLevel error 2>&1
done

# ── Step 2: Build backend for Linux ──
echo ""
echo "[2/4] Building backend (Linux)..."
cd "$BACKEND_DIR"
cargo build --release 2>&1
echo "  → Linux binary done"

# ── Step 3: Build backend for Windows (mingw) ──
echo ""
echo "[3/4] Building backend (Windows)..."
cd "$BACKEND_DIR"
CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc \
  cargo build --release --target x86_64-pc-windows-gnu 2>&1
echo "  → Windows binary done"

# ── Step 4: Package ──
echo ""
echo "[4/4] Packaging..."

for app_port in "${APPS[@]}"; do
  app="${app_port%%:*}"
  port="${app_port##*:}"
  app_dir="$ROOT/$app"
  pkg_name="${app}_${VERSION}"

  echo "  → $pkg_name"

  # ── Linux package ──
  PKG="$RELEASE_DIR/${pkg_name}_linux"
  mkdir -p "$PKG/static" "$PKG/config"
  cp "$BACKEND_DIR/target/release/bmc-backend" "$PKG/"
  cp -r "$app_dir/dist/"* "$PKG/static/"
  cp "$BACKEND_DIR/config/bmcs.json" "$PKG/config/" 2>/dev/null || echo '{"routers":[]}' > "$PKG/config/bmcs.json"

  cat > "$PKG/start.sh" << EOF
#!/bin/bash
cd "\$(dirname "\$0")"
PORT=$port ./bmc-backend
EOF
  chmod +x "$PKG/start.sh"

  cat > "$PKG/README.txt" << EOF
${app} — ${VERSION}
=================================

启动:
  Linux:   ./start.sh
  Windows: start.bat

访问: http://localhost:${port}

默认管理员账号: admin / abc123..
EOF

  cd "$RELEASE_DIR"
  tar -czf "${pkg_name}_linux.tar.gz" "${pkg_name}_linux"
  echo "    → ${pkg_name}_linux.tar.gz"

  # ── Windows package ──
  PKG_WIN="$RELEASE_DIR/${pkg_name}_windows"
  mkdir -p "$PKG_WIN/static" "$PKG_WIN/config"
  cp "$BACKEND_DIR/target/x86_64-pc-windows-gnu/release/bmc-backend.exe" "$PKG_WIN/" 2>/dev/null || {
    echo "    ⚠ Windows binary not found, skipping Windows package"
    rm -rf "$PKG_WIN"
    continue
  }
  cp -r "$app_dir/dist/"* "$PKG_WIN/static/"
  cp "$PKG/config/bmcs.json" "$PKG_WIN/config/"

  cat > "$PKG_WIN/start.bat" << EOF
@echo off
set PORT=$port
bmc-backend.exe
pause
EOF

  cat > "$PKG_WIN/README.txt" << EOF
${app} — ${VERSION}
=================================

Start:
  Linux:   ./start.sh
  Windows: start.bat

Access: http://localhost:${port}

Default admin: admin / abc123..
EOF

  cd "$RELEASE_DIR"
  zip -rq "${pkg_name}_windows.zip" "${pkg_name}_windows"
  echo "    → ${pkg_name}_windows.zip"

  # Cleanup temp dirs
  rm -rf "$PKG" "$PKG_WIN"
done

echo ""
echo "============================================"
echo "  Done! Packages in: $RELEASE_DIR"
echo "============================================"
ls -lh "$RELEASE_DIR"/*.{tar.gz,zip} 2>/dev/null
