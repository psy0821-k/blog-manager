export type HealthReason = 'DATABASE_URL_MISSING' | 'DATABASE_UNREACHABLE' | 'AUTH_NOT_CONFIGURED'

export type HealthBody =
  | { status: 'ok'; database: 'connected' }
  | {
      status: 'error'
      database: 'connected' | 'unavailable'
      reason: HealthReason
      // 인증 설정이 비었을 때만 붙는다
      auth?: 'not_configured'
    }
