import { errors, jwtVerify } from 'jose'
import type { AuthFailure } from './auth-types'

const ADMIN_ROLE = 'ADMIN'

export type VerifyAdminToken = (token: string) => Promise<AuthFailure | null>

// jose 오류 -> reason 매핑
export function toTokenReason(error: unknown): 'TOKEN_INVALID' | 'TOKEN_EXPIRED' {
  return error instanceof errors.JWTExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
}

// 성공은 null, 실패는 AuthFailure. 원인 오류 메시지는 결과에 담지 않는다.
export function createVerifyAdminToken(secret: string): VerifyAdminToken {
  const key = new TextEncoder().encode(secret)

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        requiredClaims: ['exp'],
      })

      if (payload.role !== ADMIN_ROLE) {
        return { statusCode: 403, body: { status: 'error', reason: 'FORBIDDEN' } }
      }

      return null
    } catch (error) {
      return { statusCode: 401, body: { status: 'error', reason: toTokenReason(error) } }
    }
  }
}
