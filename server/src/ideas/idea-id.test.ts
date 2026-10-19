import { describe, expect, it } from 'vitest'
import { isIdeaId } from './idea-id'

describe('isIdeaId', () => {
  it('소문자 16진수 8-4-4-4-12 형식의 uuid이면 true여야 한다', () => {
    expect(isIdeaId('3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c')).toBe(true)
  })

  it('대문자 16진수 uuid도 true여야 한다', () => {
    expect(isIdeaId('3F2B8C1E-5A4D-4E7B-9C6A-1D2E3F4A5B6C')).toBe(true)
  })

  it.each(['abc', '', 'idea-1', '3f2b8c1e5a4d4e7b9c6a1d2e3f4a5b6c'])('%j이면 false여야 한다', (value) => {
    expect(isIdeaId(value)).toBe(false)
  })

  it('길이는 맞지만 16진수가 아닌 문자가 섞이면 false여야 한다', () => {
    expect(isIdeaId('3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6g')).toBe(false)
  })

  it.each(['x3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c', '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c/', '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c/../x', '../3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c'])(
    'uuid 앞뒤에 문자가 더 붙은 %j이면 false여야 한다',
    (value) => {
      expect(isIdeaId(value)).toBe(false)
    },
  )
})
