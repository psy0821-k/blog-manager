import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { signTestToken, TEST_SECRET } from '../auth/auth-test-helpers'

const ALLOWED_ORIGIN = 'http://localhost:5173'

/** createApp을 임시 포트에 띄워 baseUrl과 함께 콜백을 실행하고 서버를 닫는다. */
async function withServer(
  adminAppOrigin: string | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = createApp({ pingDatabase: async () => {}, authSecret: TEST_SECRET, adminAppOrigin })
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

const preflight = (baseUrl: string, origin: string) =>
  fetch(`${baseUrl}/auth/check`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
  })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createCors 허용 오리진', () => {
  it('허용 오리진에서 토큰 없이 OPTIONS이면 204이고 ACAO가 그 오리진과 같고 Vary에 Origin이 있고 Allow-Credentials가 없어야 한다', async () => {
    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await preflight(baseUrl, ALLOWED_ORIGIN)

      expect(response.status).toBe(204)
      expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
      expect(response.headers.get('vary')).toContain('Origin')
      expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    })
  })

  it('허용 오리진에서 OPTIONS이면 Allow-Methods와 Allow-Headers(Authorization 포함)가 붙어야 한다', async () => {
    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await preflight(baseUrl, ALLOWED_ORIGIN)

      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, PATCH, DELETE, OPTIONS')
      expect(response.headers.get('access-control-allow-headers')).toContain('Authorization')
    })
  })

  it('허용 오리진에서 토큰 없이 GET /auth/check 401이면 ACAO가 붙고 본문 reason을 읽을 수 있어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, { headers: { Origin: ALLOWED_ORIGIN } })

      expect(response.status).toBe(401)
      expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_MISSING' })
    })
  })

  it('허용 오리진에서 유효한 토큰으로 GET /auth/check 200이면 ACAO가 붙어야 한다', async () => {
    const token = await signTestToken()

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, {
        headers: { Origin: ALLOWED_ORIGIN, Authorization: `Bearer ${token}` },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    })
  })

  it('허용 오리진의 일반 요청에는 Allow-Credentials가 없어야 한다', async () => {
    const token = await signTestToken()

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, {
        headers: { Origin: ALLOWED_ORIGIN, Authorization: `Bearer ${token}` },
      })

      expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    })
  })
})

describe('createCors 불일치 오리진', () => {
  const mismatchedOrigins = [
    ['다른 포트의', 'http://localhost:5174'],
    ['다른 호스트의', 'http://evil.example.com:5173'],
    ['다른 프로토콜(https)의', 'https://localhost:5173'],
    ['끝 슬래시가 붙은', 'http://localhost:5173/'],
  ] as const

  it.each(mismatchedOrigins)('%s 오리진 OPTIONS이면 ACAO가 없어야 한다', async (_label, origin) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await preflight(baseUrl, origin)

      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })
  })

  it('불일치 오리진 OPTIONS이면 204가 아니고 ACAO/Allow-Methods가 없어야 한다 (인증이 처리해 401)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await preflight(baseUrl, 'http://localhost:5174')

      expect(response.status).toBe(401)
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
      expect(response.headers.get('access-control-allow-methods')).toBeNull()
    })
  })

  it('토큰 없이 보호 경로를 호출하면 불일치 오리진의 401 응답에 ACAO가 없어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, { headers: { Origin: 'http://localhost:5174' } })

      expect(response.status).toBe(401)
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })
  })
})

describe('createCors 미설정', () => {
  it('adminAppOrigin이 undefined이고 어떤 오리진에서 OPTIONS이면 ACAO가 없어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(undefined, async (baseUrl) => {
      const response = await preflight(baseUrl, ALLOWED_ORIGIN)

      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })
  })

  it('adminAppOrigin이 빈 문자열이고 어떤 오리진에서 OPTIONS이면 ACAO가 없어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer('', async (baseUrl) => {
      const response = await preflight(baseUrl, ALLOWED_ORIGIN)

      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })
  })
})

describe('createCors Origin 헤더 없는 요청', () => {
  it('Origin 헤더 없이 토큰 없는 GET /auth/check이면 401 TOKEN_MISSING이고 ACAO가 없어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_MISSING' })
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })
  })

  it('Origin 헤더 없이 유효한 토큰으로 GET /auth/check이면 200이고 ACAO가 없어야 한다', async () => {
    const token = await signTestToken()

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, { headers: { Authorization: `Bearer ${token}` } })

      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
    })
  })
})

describe('createCors 처리 순서', () => {
  it('허용 오리진 사전 요청이면 OPTIONS가 인증보다 먼저 처리돼 console.error 로그가 남지 않아야 한다', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(ALLOWED_ORIGIN, async (baseUrl) => {
      const response = await preflight(baseUrl, ALLOWED_ORIGIN)

      expect(response.status).toBe(204)
    })

    expect(errorSpy).not.toHaveBeenCalled()
  })
})
