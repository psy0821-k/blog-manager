import { describe, expect, it } from 'vitest'
import { MissingEnvError, readPort, readRequiredEnv } from './env'

describe('readRequiredEnv', () => {
  it('키에 값이 있을 때 그 값을 돌려줘야 한다', () => {
    expect(readRequiredEnv({ DATABASE_URL: 'value' }, 'DATABASE_URL')).toBe('value')
  })

  it('값 앞뒤에 공백이 있을 때 공백을 제거한 값을 돌려줘야 한다', () => {
    expect(readRequiredEnv({ DATABASE_URL: '  value  ' }, 'DATABASE_URL')).toBe('value')
  })

  it('키가 없을 때 그 키 이름을 담은 MissingEnvError를 던져야 한다', () => {
    const read = () => readRequiredEnv({}, 'DATABASE_URL')

    expect(read).toThrow(MissingEnvError)
    expect(read).toThrow(expect.objectContaining({ key: 'DATABASE_URL' }))
  })

  it('값이 공백뿐일 때 MissingEnvError를 던져야 한다', () => {
    expect(() => readRequiredEnv({ DATABASE_URL: '   ' }, 'DATABASE_URL')).toThrow(MissingEnvError)
  })

  it('다른 키에 비밀 값이 들어 있어도 MissingEnvError 메시지에는 키 이름만 있고 값은 없어야 한다', () => {
    const source = { DIRECT_URL: 'super-secret-value' }

    let message = ''
    try {
      readRequiredEnv(source, 'DATABASE_URL')
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }

    expect(message).toContain('DATABASE_URL')
    expect(message).not.toContain('super-secret-value')
  })
})

describe('readPort', () => {
  it('PORT가 없을 때 8787을 돌려줘야 한다', () => {
    expect(readPort({})).toBe(8787)
  })

  it('PORT가 "9123"일 때 9123을 돌려줘야 한다', () => {
    expect(readPort({ PORT: '9123' })).toBe(9123)
  })

  it('기본 포트가 Vite 개발 서버 포트(5173)와 겹치지 않아야 한다', () => {
    expect(readPort({})).not.toBe(5173)
  })

  it('PORT가 1 또는 65535일 때 그대로 허용해야 한다', () => {
    expect(readPort({ PORT: '1' })).toBe(1)
    expect(readPort({ PORT: '65535' })).toBe(65535)
  })

  it('PORT가 "abc"일 때 Error를 던져야 한다', () => {
    expect(() => readPort({ PORT: 'abc' })).toThrow(Error)
  })

  it('PORT가 0 또는 65536일 때 Error를 던져야 한다', () => {
    expect(() => readPort({ PORT: '0' })).toThrow(Error)
    expect(() => readPort({ PORT: '65536' })).toThrow(Error)
  })
})
