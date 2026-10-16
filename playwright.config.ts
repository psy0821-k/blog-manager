import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    // 로컬 더미 블로그 로그인 주소(운영 주소·.env 값을 쓰지 않는다)
    env: { VITE_BLOG_LOGIN_URL: 'http://localhost:3999/admin-login' },
  },
})
