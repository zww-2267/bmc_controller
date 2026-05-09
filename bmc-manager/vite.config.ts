import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Tauri 需要固定端口，避免与 Tauri 配置中的 devUrl 不一致
  server: {
    port: 5173,
    strictPort: true,
  },
  // 生产构建清除 sourcemap，减小体积
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
})
