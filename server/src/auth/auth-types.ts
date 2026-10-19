export type AuthReason = 'TOKEN_MISSING' | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'FORBIDDEN'

export interface AuthFailureBody {
  status: 'error'
  reason: AuthReason
}

export interface AuthFailure {
  statusCode: 401 | 403
  body: AuthFailureBody
}
