import { describe, expect, it } from 'vitest'
import { extractBearerToken } from './extract-bearer-token'

describe('extractBearerToken', () => {
  it('Bearer abc.def.ghi일 때 토큰 문자열을 돌려줘야 한다', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('헤더가 undefined일 때 null을 돌려줘야 한다', () => {
    expect(extractBearerToken(undefined)).toBeNull()
  })

  it('스킴이 Bearer가 아닐 때 null을 돌려줘야 한다', () => {
    expect(extractBearerToken('Basic xxx')).toBeNull()
  })

  it('Bearer만 있고 토큰이 비었을 때 null을 돌려줘야 한다', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
  })

  it('스킴 대소문자가 다를 때 null을 돌려줘야 한다', () => {
    expect(extractBearerToken('bearer abc')).toBeNull()
  })
})
