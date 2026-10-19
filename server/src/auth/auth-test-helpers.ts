import { SignJWT } from 'jose'

export const TEST_SECRET = 'test-secret-value-for-auth-tests-0123456789'
export const OTHER_SECRET = 'another-secret-value-0123456789-abcdef'

interface SignOptions {
  secret?: string
  alg?: 'HS256' | 'HS512'
  /** null이면 role 클레임을 넣지 않는다 */
  role?: string | null
  /** 초 단위 만료 시각. 생략하면 1시간 뒤, null이면 exp 클레임을 넣지 않는다 */
  expiresAt?: number | null
}

/** 테스트용 JWT를 만든다. role 기본값은 ADMIN. */
export async function signTestToken({
  secret = TEST_SECRET,
  alg = 'HS256',
  role = 'ADMIN',
  expiresAt,
}: SignOptions = {}): Promise<string> {
  const payload = role === null ? {} : { role }
  const jwt = new SignJWT(payload).setProtectedHeader({ alg }).setIssuedAt()

  if (expiresAt === undefined) jwt.setExpirationTime('1h')
  else if (expiresAt !== null) jwt.setExpirationTime(expiresAt)

  return jwt.sign(new TextEncoder().encode(secret))
}

/** alg가 none이고 서명이 없는 토큰 */
export function createNoneAlgToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ role: 'ADMIN', exp })}.`
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
