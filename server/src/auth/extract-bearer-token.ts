const BEARER_PREFIX = 'Bearer '

// "Bearer <토큰>" 형식이 아니거나 토큰이 비면 null
export function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith(BEARER_PREFIX)) return null

  const token = authorization.slice(BEARER_PREFIX.length).trim()

  return token === '' ? null : token
}
