import { MissingEnvError } from '../config/env'
import type { PingDatabase } from '../db/prisma-client'
import type { HealthBody } from './health-types'

export interface HealthResult {
  statusCode: 200 | 503
  body: HealthBody
}

export async function checkHealth(ping: PingDatabase): Promise<HealthResult> {
  try {
    await ping()
    return { statusCode: 200, body: { status: 'ok', database: 'connected' } }
  } catch (error) {
    // 원인 오류의 메시지는 연결 문자열을 담을 수 있어 응답에 쓰지 않고 reason 코드로만 알린다
    const reason = error instanceof MissingEnvError ? 'DATABASE_URL_MISSING' : 'DATABASE_UNREACHABLE'
    return { statusCode: 503, body: { status: 'error', database: 'unavailable', reason } }
  }
}
