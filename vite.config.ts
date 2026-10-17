import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const GEMINI_API_ORIGIN = 'https://generativelanguage.googleapis.com'
const GEMINI_GENERATE_PATH = '/v1beta/models/gemini-flash-latest:generateContent'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 프록시 대상은 서버 측 전용 변수라 VITE_ 접두사 없이 직접 읽는다
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.BLOG_API_PROXY_TARGET
  const geminiApiKey = env.GEMINI_API_KEY

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Playwright E2E 스펙은 Vitest가 읽지 않는다
      exclude: ['e2e/**', 'node_modules/**'],
    },
    server: {
      // 블로그의 CORS 설정 전까지 개발 서버가 /api를 중계한다
      proxy: {
        ...(proxyTarget ? { '/api': { target: proxyTarget, changeOrigin: true } } : {}),
        // Gemini 키는 브라우저로 내보내지 않고 이 프록시가 헤더로만 붙인다. 모델과 경로는 고정한다
        '/ai/generate': {
          target: GEMINI_API_ORIGIN,
          changeOrigin: true,
          rewrite: () => GEMINI_GENERATE_PATH,
          headers: geminiApiKey ? { 'x-goog-api-key': geminiApiKey } : undefined,
        },
      },
    },
  }
})
