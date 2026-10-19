import { readOptionalEnv } from '../config/env'
import type { EnvSource } from '../config/env'

// AUTH_SECRET이 없거나 공백뿐이면 던지지 않고 undefined를 돌려준다. 로그에는 키 이름만 남긴다
export function readAuthSecret(source: EnvSource, log: (message: string) => void = console.error): string | undefined {
  const secret = readOptionalEnv(source, 'AUTH_SECRET')
  if (!secret) log('[auth] 환경변수 AUTH_SECRET이 설정되지 않아 보호 경로가 503으로 응답합니다.')

  return secret
}
