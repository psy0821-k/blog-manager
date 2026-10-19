import { describe, expect, it, vi } from 'vitest'
import { readAuthSecret } from './read-auth-secret'

describe('readAuthSecret', () => {
  it('AUTH_SECRET에 값이 있으면 trim한 값을 돌려주고 로그를 남기지 않아야 한다', () => {
    const log = vi.fn()

    expect(readAuthSecret({ AUTH_SECRET: '  my-secret  ' }, log)).toBe('my-secret')
    expect(log).not.toHaveBeenCalled()
  })

  it('AUTH_SECRET이 없으면 undefined를 돌려주고 던지지 않아야 한다', () => {
    expect(() => readAuthSecret({}, vi.fn())).not.toThrow()
    expect(readAuthSecret({}, vi.fn())).toBeUndefined()
  })

  it('AUTH_SECRET이 빈 문자열 또는 공백뿐이면 undefined를 돌려줘야 한다', () => {
    expect(readAuthSecret({ AUTH_SECRET: '' }, vi.fn())).toBeUndefined()
    expect(readAuthSecret({ AUTH_SECRET: '   ' }, vi.fn())).toBeUndefined()
  })

  it('누락됐으면 log에 키 이름 AUTH_SECRET이 들어 있어야 한다', () => {
    const log = vi.fn()

    readAuthSecret({}, log)

    expect(log).toHaveBeenCalledTimes(1)
    expect(String(log.mock.calls[0][0])).toContain('AUTH_SECRET')
  })

  it('값이 공백뿐인 문자열이어도 log에 그 값이 나오지 않아야 한다', () => {
    const log = vi.fn()
    const whitespace = '     \t  '

    readAuthSecret({ AUTH_SECRET: whitespace }, log)

    const logged = log.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('AUTH_SECRET')
    expect(logged).not.toContain(whitespace)
  })

  it('source에 DATABASE_URL 등 다른 환경변수가 있어도 그 값이 log에 없어야 한다', () => {
    const log = vi.fn()
    const databaseUrl = 'postgresql://user:leaked-password@host.example/db'

    readAuthSecret({ DATABASE_URL: databaseUrl, ADMIN_APP_ORIGIN: 'http://localhost:5173' }, log)

    const logged = log.mock.calls.flat().map(String).join(' ')
    expect(logged).not.toContain(databaseUrl)
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toContain('localhost:5173')
  })
})
