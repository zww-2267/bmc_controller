import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
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
