import { MissingEnvError } from '../config/env'
import type { PingDatabase } from '../db/prisma-client'
import type { HealthBody } from './health-types'

export interface HealthResult {
  statusCode: 200 | 503
  body: HealthBody
}

export async function checkHealth(ping: PingDatabase, authConfigured = true): Promise<HealthResult> {
  let database: 'connected' | 'unavailable' = 'connected'
  let databaseReason: 'DATABASE_URL_MISSING' | 'DATABASE_UNREACHABLE' = 'DATABASE_UNREACHABLE'

  try {
    await ping()
  } catch (error) {
    // 원인 오류의 메시지는 연결 문자열을 담을 수 있어 응답에 쓰지 않고 reason 코드로만 알린다
    database = 'unavailable'
    if (error instanceof MissingEnvError) databaseReason = 'DATABASE_URL_MISSING'
  }

  // 인증 설정 누락은 DB 원인보다 우선한다
  if (!authConfigured) {
    return {
      statusCode: 503,
      body: { status: 'error', database, reason: 'AUTH_NOT_CONFIGURED', auth: 'not_configured' },
    }
  }

  if (database === 'unavailable') {
    return { statusCode: 503, body: { status: 'error', database, reason: databaseReason } }
  }

  return { statusCode: 200, body: { status: 'ok', database: 'connected' } }
}
