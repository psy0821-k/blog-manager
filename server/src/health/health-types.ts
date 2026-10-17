export type HealthReason = 'DATABASE_URL_MISSING' | 'DATABASE_UNREACHABLE'

export type HealthBody =
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'unavailable'; reason: HealthReason }
