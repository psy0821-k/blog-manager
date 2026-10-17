import { afterEach, describe, expect, it, vi } from 'vitest'

const POOLED_URL = 'postgresql://pooled-user:pooled-password@pooled-host.example/db'
const DIRECT_URL = 'postgresql://direct-user:direct-password@direct-host.example/db'

/** 환경변수를 바꾼 뒤 설정을 새로 읽는다. 모듈 캐시를 비워야 env() 평가가 다시 일어난다. */
async function loadConfig() {
  vi.resetModules()
  const module = await import('./prisma.config')
  return module.default
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('prisma.config', () => {
  it('DIRECT_URL이 설정돼 있을 때 datasource.url이 DIRECT_URL 값이어야 한다', async () => {
    vi.stubEnv('DIRECT_URL', DIRECT_URL)

    const config = await loadConfig()

    expect(config.datasource?.url).toBe(DIRECT_URL)
  })

  it('DATABASE_URL과 DIRECT_URL이 다를 때 마이그레이션용 url은 DATABASE_URL(풀링)이 아니어야 한다', async () => {
    vi.stubEnv('DATABASE_URL', POOLED_URL)
    vi.stubEnv('DIRECT_URL', DIRECT_URL)

    const config = await loadConfig()

    expect(config.datasource?.url).not.toBe(POOLED_URL)
  })

  it('DIRECT_URL이 없을 때 설정을 읽으면 키 이름을 알 수 있는 오류가 나야 한다', async () => {
    vi.stubEnv('DATABASE_URL', POOLED_URL)
    vi.stubEnv('DIRECT_URL', '')

    await expect(loadConfig()).rejects.toThrow(/DIRECT_URL/)
  })
})
