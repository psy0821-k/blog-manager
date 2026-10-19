import { afterEach, describe, expect, it, vi } from 'vitest'

async function importEnv() {
  vi.resetModules()
  return import('../env')
}

describe('SERVER_API_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('VITE_SERVER_API_URL이 있으면 그 값을 SERVER_API_URL로 써야 한다', async () => {
    vi.stubEnv('VITE_SERVER_API_URL', 'https://server.example')

    const { SERVER_API_URL } = await importEnv()

    expect(SERVER_API_URL).toBe('https://server.example')
  })

  it('VITE_SERVER_API_URL의 끝의 /를 제거해야 한다', async () => {
    vi.stubEnv('VITE_SERVER_API_URL', 'https://server.example/')

    const { SERVER_API_URL } = await importEnv()

    expect(SERVER_API_URL).toBe('https://server.example')
  })

  it('값이 빈 문자열이면 개발 프록시 경로 /server-api여야 한다', async () => {
    vi.stubEnv('VITE_SERVER_API_URL', '')

    const { SERVER_API_URL } = await importEnv()

    expect(SERVER_API_URL).toBe('/server-api')
  })

  it('값이 설정되지 않았으면 개발 프록시 경로 /server-api여야 한다', async () => {
    vi.stubEnv('VITE_SERVER_API_URL', undefined)

    const { SERVER_API_URL } = await importEnv()

    expect(SERVER_API_URL).toBe('/server-api')
  })
})
