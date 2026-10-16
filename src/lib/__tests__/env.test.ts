import { afterEach, describe, expect, it, vi } from 'vitest'

async function importEnv() {
  vi.resetModules()
  return import('../env')
}

describe('BLOG_LOGIN_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('VITE_BLOG_LOGIN_URL의 끝의 /를 제거해야 한다', async () => {
    vi.stubEnv('VITE_BLOG_LOGIN_URL', 'http://localhost:3000/admin-login/')

    const { BLOG_LOGIN_URL } = await importEnv()

    expect(BLOG_LOGIN_URL).toBe('http://localhost:3000/admin-login')
  })

  it('값이 없으면 빈 문자열이어야 한다', async () => {
    vi.stubEnv('VITE_BLOG_LOGIN_URL', '')

    const { BLOG_LOGIN_URL } = await importEnv()

    expect(BLOG_LOGIN_URL).toBe('')
  })
})
