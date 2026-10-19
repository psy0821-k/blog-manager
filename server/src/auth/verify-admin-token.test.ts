import { describe, expect, it } from 'vitest'
import { createNoneAlgToken, nowSeconds, OTHER_SECRET, signTestToken, TEST_SECRET } from './auth-test-helpers'
import { createVerifyAdminToken } from './verify-admin-token'

const verify = createVerifyAdminToken(TEST_SECRET)

describe('createVerifyAdminToken', () => {
  it('유효한 HS256 ADMIN 토큰이면 null을 돌려줘야 한다', async () => {
    expect(await verify(await signTestToken())).toBeNull()
  })

  it('다른 secret으로 서명했을 때 401 TOKEN_INVALID를 돌려줘야 한다', async () => {
    const token = await signTestToken({ secret: OTHER_SECRET })

    expect(await verify(token)).toEqual({ statusCode: 401, body: { status: 'error', reason: 'TOKEN_INVALID' } })
  })

  it('토큰 형식이 깨졌을 때 401 TOKEN_INVALID를 돌려줘야 한다', async () => {
    expect(await verify('abc')).toEqual({ statusCode: 401, body: { status: 'error', reason: 'TOKEN_INVALID' } })
  })

  it('alg가 none일 때 401 TOKEN_INVALID를 돌려줘야 한다', async () => {
    expect(await verify(createNoneAlgToken())).toEqual({
      statusCode: 401,
      body: { status: 'error', reason: 'TOKEN_INVALID' },
    })
  })

  it('alg가 HS512일 때 401 TOKEN_INVALID를 돌려줘야 한다', async () => {
    const token = await signTestToken({ alg: 'HS512' })

    expect(await verify(token)).toEqual({ statusCode: 401, body: { status: 'error', reason: 'TOKEN_INVALID' } })
  })

  it('exp가 없을 때 401 TOKEN_INVALID를 돌려줘야 한다', async () => {
    const token = await signTestToken({ expiresAt: null })

    expect(await verify(token)).toEqual({ statusCode: 401, body: { status: 'error', reason: 'TOKEN_INVALID' } })
  })

  it('exp가 과거일 때 401 TOKEN_EXPIRED를 돌려줘야 한다', async () => {
    const token = await signTestToken({ expiresAt: nowSeconds() - 60 })

    expect(await verify(token)).toEqual({ statusCode: 401, body: { status: 'error', reason: 'TOKEN_EXPIRED' } })
  })

  it('role이 USER일 때 403 FORBIDDEN을 돌려줘야 한다', async () => {
    const token = await signTestToken({ role: 'USER' })

    expect(await verify(token)).toEqual({ statusCode: 403, body: { status: 'error', reason: 'FORBIDDEN' } })
  })

  it('role 클레임이 없을 때 403 FORBIDDEN을 돌려줘야 한다', async () => {
    const token = await signTestToken({ role: null })

    expect(await verify(token)).toEqual({ statusCode: 403, body: { status: 'error', reason: 'FORBIDDEN' } })
  })

  it('어떤 실패든 결과 body에 토큰과 secret이 없어야 한다', async () => {
    const tokens = [
      await signTestToken({ secret: OTHER_SECRET }),
      'abc',
      createNoneAlgToken(),
      await signTestToken({ expiresAt: nowSeconds() - 60 }),
      await signTestToken({ role: 'USER' }),
    ]

    for (const token of tokens) {
      const result = await verify(token)
      const serialized = JSON.stringify(result)

      expect(result).not.toBeNull()
      expect(Object.keys(result?.body ?? {}).sort()).toEqual(['reason', 'status'])
      expect(serialized).not.toContain(token)
      expect(serialized).not.toContain(TEST_SECRET)
    }
  })
})
