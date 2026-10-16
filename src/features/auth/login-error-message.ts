/** 오류 코드 → 고정된 한국어 문구. 코드를 화면에 그대로 노출하지 않는다. */
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  'invalid-token': '로그인 정보를 확인할 수 없습니다.',
  'access-denied': '관리자 계정으로만 로그인할 수 있습니다.',
}

/** 알 수 없는 코드에 쓰는 일반 문구 */
export const GENERIC_LOGIN_ERROR_MESSAGE = '로그인에 실패했습니다. 다시 시도해 주세요.'

/** error 쿼리 값을 안내 문구로 바꾼다. 쿼리가 없으면 null(오류 화면이 아님). */
export function getLoginErrorMessage(errorCode: string | null): string | null {
  if (errorCode === null) {
    return null
  }

  return Object.hasOwn(LOGIN_ERROR_MESSAGES, errorCode)
    ? LOGIN_ERROR_MESSAGES[errorCode]
    : GENERIC_LOGIN_ERROR_MESSAGE
}
