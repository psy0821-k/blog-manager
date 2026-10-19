import { describe, expect, it, vi } from 'vitest'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import { checkHealth } from './check-health'

const LEAKY_MESSAGE = 'failed: postgresql://user:leaked-password@host.example/db'

describe('checkHealth', () => {
  it('ping이 성공할 때 200과 { status: ok, database: connected }를 돌려줘야 한다', async () => {
    const result = await checkHealth(async () => {})

    expect(result).toEqual({ statusCode: 200, body: { status: 'ok', database: 'connected' } })
  })

  it('ping이 DatabaseUnreachableError로 거부될 때 503과 DATABASE_UNREACHABLE을 돌려줘야 한다', async () => {
    const result = await checkHealth(async () => {
      throw new DatabaseUnreachableError()
    })

    expect(result).toEqual({
      statusCode: 503,
      body: { status: 'error', database: 'unavailable', reason: 'DATABASE_UNREACHABLE' },
    })
  })

  it('ping이 MissingEnvError로 거부될 때 503과 DATABASE_URL_MISSING을 돌려줘야 한다', async () => {
    const result = await checkHealth(async () => {
      throw new MissingEnvError('DATABASE_URL')
    })

    expect(result).toEqual({
      statusCode: 503,
      body: { status: 'error', database: 'unavailable', reason: 'DATABASE_URL_MISSING' },
    })
  })

  it('ping이 알 수 없는 오류로 거부될 때 503과 DATABASE_UNREACHABLE을 돌려주고 오류 메시지는 body에 없어야 한다', async () => {
    const result = await checkHealth(async () => {
      throw new Error(LEAKY_MESSAGE)
    })

    expect(result.statusCode).toBe(503)
    expect(result.body).toEqual({ status: 'error', database: 'unavailable', reason: 'DATABASE_UNREACHABLE' })
  })

  it('어떤 실패에서도 body를 직렬화한 문자열에 연결 문자열 형태(postgres://)가 없어야 한다', async () => {
    const failures = [
      new DatabaseUnreachableError(),
      new MissingEnvError('DATABASE_URL'),
      new Error(LEAKY_MESSAGE),
    ]

    for (const failure of failures) {
      const { body } = await checkHealth(async () => {
        throw failure
      })

      expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\//)
    }
  })

  it('authConfigured가 true(기본)이고 ping이 성공하면 200과 { status: ok, database: connected }를 돌려줘야 한다', async () => {
    const result = await checkHealth(async () => {}, true)

    expect(result).toEqual({ statusCode: 200, body: { status: 'ok', database: 'connected' } })
  })

  it('authConfigured가 false이고 ping이 성공하면 503과 AUTH_NOT_CONFIGURED, auth: not_configured를 돌려줘야 한다', async () => {
    const result = await checkHealth(async () => {}, false)

    expect(result).toEqual({
      statusCode: 503,
      body: { status: 'error', database: 'connected', reason: 'AUTH_NOT_CONFIGURED', auth: 'not_configured' },
    })
  })

  it('authConfigured가 false이고 ping이 MissingEnvError로 거부되면 database unavailable과 AUTH_NOT_CONFIGURED를 돌려줘야 한다', async () => {
    const result = await checkHealth(async () => {
      throw new MissingEnvError('DATABASE_URL')
    }, false)

    expect(result).toEqual({
      statusCode: 503,
      body: { status: 'error', database: 'unavailable', reason: 'AUTH_NOT_CONFIGURED', auth: 'not_configured' },
    })
  })

  it('authConfigured가 false이고 ping이 DatabaseUnreachableError로 거부되어도 AUTH_NOT_CONFIGURED가 우선해야 한다', async () => {
    const result = await checkHealth(async () => {
      throw new DatabaseUnreachableError()
    }, false)

    expect(result).toEqual({
      statusCode: 503,
      body: { status: 'error', database: 'unavailable', reason: 'AUTH_NOT_CONFIGURED', auth: 'not_configured' },
    })
  })

  it('authConfigured가 true이고 ping이 실패하면 기존 DB 실패 body에 auth 키가 없어야 한다', async () => {
    const { body } = await checkHealth(async () => {
      throw new DatabaseUnreachableError()
    }, true)

    expect(body).not.toHaveProperty('auth')
  })

  it('authConfigured가 false여도 ping을 호출해야 한다', async () => {
    const ping = vi.fn(async () => {})

    await checkHealth(ping, false)

    expect(ping).toHaveBeenCalledTimes(1)
  })
})
