import { describe, expect, it } from 'vitest'
import { GENERIC_LOGIN_ERROR_MESSAGE, getLoginErrorMessage } from '../login-error-message'

describe('getLoginErrorMessage', () => {
  it('invalid-token이면 로그인 정보를 확인할 수 없다는 문구를 반환해야 한다', () => {
    expect(getLoginErrorMessage('invalid-token')).toBe('로그인 정보를 확인할 수 없습니다.')
  })

  it('access-denied이면 관리자 계정 안내 문구를 반환해야 한다', () => {
    expect(getLoginErrorMessage('access-denied')).toBe('관리자 계정으로만 로그인할 수 있습니다.')
  })

  it('null이면 null을 반환해야 한다', () => {
    expect(getLoginErrorMessage(null)).toBeNull()
  })

  it('빈 문자열이면 일반 문구를 반환해야 한다', () => {
    expect(getLoginErrorMessage('')).toBe(GENERIC_LOGIN_ERROR_MESSAGE)
    expect(GENERIC_LOGIN_ERROR_MESSAGE).toBe('로그인에 실패했습니다. 다시 시도해 주세요.')
  })

  it('알 수 없는 코드이면 일반 문구를 반환해야 한다', () => {
    expect(getLoginErrorMessage('something-else')).toBe('로그인에 실패했습니다. 다시 시도해 주세요.')
  })

  it('대소문자가 다른 코드는 알 수 없는 코드로 보고 일반 문구를 반환해야 한다', () => {
    expect(getLoginErrorMessage('INVALID-TOKEN')).toBe('로그인에 실패했습니다. 다시 시도해 주세요.')
  })

  it.each(['toString', 'constructor', '__proto__'])(
    'Object 내장 키 %s여도 일반 문구를 반환해야 한다',
    code => {
      expect(getLoginErrorMessage(code)).toBe('로그인에 실패했습니다. 다시 시도해 주세요.')
    },
  )

  it('입력한 코드 문자열을 문구에 포함하지 않고 일반 문구와 정확히 같아야 한다', () => {
    const message = getLoginErrorMessage('<script>x</script>')

    expect(message).toBe('로그인에 실패했습니다. 다시 시도해 주세요.')
    expect(message).not.toContain('script')
  })
})
