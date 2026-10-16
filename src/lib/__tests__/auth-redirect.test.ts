import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildBlogLoginUrl,
  buildBlogLogoutUrl,
  readTokenFromHash,
  redirectToBlogLogin,
  redirectToBlogLogout,
  resetRedirectState,
  sanitizeReturnPath,
  saveReturnPath,
  takeReturnPath,
} from '../auth-redirect'

vi.mock('../env', () => ({ BLOG_LOGIN_URL: 'http://localhost:3000/admin-login' }))

beforeEach(() => {
  sessionStorage.clear()
})

describe('sanitizeReturnPath', () => {
  it('/manage처럼 앱 내부 경로이면 그대로 반환해야 한다', () => {
    expect(sanitizeReturnPath('/manage')).toBe('/manage')
  })

  it('/manage?page=2처럼 쿼리가 있는 내부 경로이면 쿼리를 보존해 반환해야 한다', () => {
    expect(sanitizeReturnPath('/manage?page=2')).toBe('/manage?page=2')
  })

  it('null이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath(null)).toBe('/')
  })

  it('undefined이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath(undefined)).toBe('/')
  })

  it('빈 문자열이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('')).toBe('/')
  })

  it('/로 시작하지 않는 상대 경로이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('manage')).toBe('/')
  })

  it('외부 URL이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('https://evil.example/x')).toBe('/')
  })

  it('//로 시작하면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('//evil.example')).toBe('/')
  })

  it('\를 포함하면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('/\\evil.example')).toBe('/')
  })

  it('/login이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('/login')).toBe('/')
  })

  it('쿼리가 붙은 /login이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('/login?error=x')).toBe('/')
  })

  it('/auth/callback이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('/auth/callback')).toBe('/')
  })

  it('해시나 쿼리가 붙은 /auth/callback이면 /를 반환해야 한다', () => {
    expect(sanitizeReturnPath('/auth/callback#token=x')).toBe('/')
    expect(sanitizeReturnPath('/auth/callback?a=1')).toBe('/')
  })

  it('/login-help처럼 /login으로 시작만 하는 다른 경로이면 그대로 반환해야 한다', () => {
    expect(sanitizeReturnPath('/login-help')).toBe('/login-help')
  })
})

describe('saveReturnPath / takeReturnPath', () => {
  it('saveReturnPath 후 takeReturnPath를 호출하면 저장한 경로를 반환해야 한다', () => {
    saveReturnPath('/manage')

    expect(takeReturnPath()).toBe('/manage')
  })

  it('한 번 읽은 뒤 다시 호출하면 저장값이 지워져 /를 반환해야 한다', () => {
    saveReturnPath('/manage')
    takeReturnPath()

    expect(takeReturnPath()).toBe('/')
  })

  it('저장된 값이 없으면 /를 반환해야 한다', () => {
    expect(takeReturnPath()).toBe('/')
  })

  it('저장된 값이 //evil.example이면 /를 반환해야 한다', () => {
    saveReturnPath('//evil.example')

    expect(takeReturnPath()).toBe('/')
  })

  it('저장된 값이 /login이면 /를 반환해야 한다', () => {
    saveReturnPath('/login')

    expect(takeReturnPath()).toBe('/')
  })
})

describe('buildBlogLoginUrl', () => {
  it('로그인 주소와 콜백 주소를 주면 ?redirect=에 콜백 주소를 인코딩해 붙여야 한다', () => {
    const url = buildBlogLoginUrl('http://localhost:3000/admin-login', 'http://localhost:5173/auth/callback')

    expect(url).toBe(
      `http://localhost:3000/admin-login?redirect=${encodeURIComponent('http://localhost:5173/auth/callback')}`,
    )
  })

  it('콜백 주소에 :와 /가 있어도 encodeURIComponent 결과와 정확히 같아야 한다', () => {
    const callback = 'http://localhost:5173/auth/callback'
    const url = buildBlogLoginUrl('http://blog.test/admin-login', callback)

    expect(url.split('?redirect=')[1]).toBe(encodeURIComponent(callback))
    expect(url).toContain('http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback')
  })
})

describe('readTokenFromHash', () => {
  it('#token=abc.def.ghi이면 abc.def.ghi를 반환해야 한다', () => {
    expect(readTokenFromHash('#token=abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('빈 문자열이면 null을 반환해야 한다', () => {
    expect(readTokenFromHash('')).toBeNull()
  })

  it('#만 있으면 null을 반환해야 한다', () => {
    expect(readTokenFromHash('#')).toBeNull()
  })

  it('#token=처럼 값이 비면 null을 반환해야 한다', () => {
    expect(readTokenFromHash('#token=')).toBeNull()
  })

  it('#other=abc처럼 token 키가 없으면 null을 반환해야 한다', () => {
    expect(readTokenFromHash('#other=abc')).toBeNull()
  })
})

describe('redirectToBlogLogin', () => {
  const assign = vi.fn()

  beforeEach(() => {
    assign.mockClear()
    // 테스트 간 모듈 상태 공유를 끊는다
    resetRedirectState()
    vi.stubGlobal('location', { origin: 'http://localhost:5173', assign })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('/manage로 호출하면 복귀 경로를 저장하고 블로그 로그인 주소로 window.location.assign을 호출해야 한다', () => {
    redirectToBlogLogin('/manage')

    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(
      `http://localhost:3000/admin-login?redirect=${encodeURIComponent('http://localhost:5173/auth/callback')}`,
    )
  })

  it('호출 후 takeReturnPath()가 넘긴 경로를 돌려줘야 한다', () => {
    redirectToBlogLogin('/manage?page=2')

    expect(takeReturnPath()).toBe('/manage?page=2')
  })
})

describe('redirectToBlogLogin 중복 방지', () => {
  const assign = vi.fn()

  beforeEach(() => {
    assign.mockClear()
    resetRedirectState()
    vi.stubGlobal('location', { origin: 'http://localhost:5173', assign })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('같은 경로로 연속 두 번 호출해도 window.location.assign은 한 번만 호출되어야 한다', () => {
    redirectToBlogLogin('/manage')
    redirectToBlogLogin('/manage')

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('서로 다른 경로로 두 번 호출하면 assign은 한 번만 호출되고 복귀 경로는 첫 번째 값을 유지해야 한다', () => {
    redirectToBlogLogin('/manage')
    redirectToBlogLogin('/')

    expect(assign).toHaveBeenCalledTimes(1)
    expect(takeReturnPath()).toBe('/manage')
  })

  it('열 번 동시에 호출해도 assign은 한 번만 호출되어야 한다', () => {
    for (let i = 0; i < 10; i += 1) {
      redirectToBlogLogin('/manage')
    }

    expect(assign).toHaveBeenCalledTimes(1)
  })
})

describe('resetRedirectState', () => {
  const assign = vi.fn()

  beforeEach(() => {
    assign.mockClear()
    vi.stubGlobal('location', { origin: 'http://localhost:5173', assign })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('호출한 뒤에는 redirectToBlogLogin이 다시 assign을 호출해야 한다', () => {
    resetRedirectState()
    redirectToBlogLogin('/manage')
    resetRedirectState()
    redirectToBlogLogin('/manage')

    expect(assign).toHaveBeenCalledTimes(2)
  })

  it('이미 초기 상태에서 호출해도 오류 없이 redirectToBlogLogin이 정상 동작해야 한다', () => {
    resetRedirectState()
    resetRedirectState()

    expect(() => redirectToBlogLogin('/manage')).not.toThrow()
    expect(assign).toHaveBeenCalledTimes(1)
  })
})

describe('buildBlogLogoutUrl', () => {
  it('블로그 로그인 주소의 오리진에 /admin-logout을 붙이고 돌아올 주소를 redirect로 실어야 한다', () => {
    expect(buildBlogLogoutUrl('http://localhost:3000/admin-login', 'http://localhost:5173/login?loggedOut=1')).toBe(
      `http://localhost:3000/admin-logout?redirect=${encodeURIComponent('http://localhost:5173/login?loggedOut=1')}`,
    )
  })
})

describe('redirectToBlogLogout', () => {
  const assign = vi.fn()

  beforeEach(() => {
    assign.mockClear()
    vi.stubGlobal('location', { origin: 'http://localhost:5173', assign })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('블로그 로그아웃 주소로 이동하고 돌아올 곳을 로그아웃 안내 화면으로 지정해야 한다', () => {
    redirectToBlogLogout()

    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(
      `http://localhost:3000/admin-logout?redirect=${encodeURIComponent('http://localhost:5173/login?loggedOut=1')}`,
    )
  })
})
