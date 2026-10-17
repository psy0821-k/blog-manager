import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 프록시 대상은 서버 측 전용 변수라 VITE_ 접두사 없이 직접 읽는다
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.BLOG_API_PROXY_TARGET

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Playwright E2E 스펙과 별도 패키지인 server/ 테스트는 루트 Vitest가 읽지 않는다
      exclude: ['e2e/**', 'server/**', 'node_modules/**'],
    },
    server: {
      // 블로그의 CORS 설정 전까지 개발 서버가 /api를 중계한다
      proxy: proxyTarget
        ? { '/api': { target: proxyTarget, changeOrigin: true } }
        : undefined,
    },
  }
})
