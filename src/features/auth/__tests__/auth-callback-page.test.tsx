import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as authRedirect from '@/lib/auth-redirect'
import { AuthCallbackPage } from '../auth-callback-page'

// auth-token.ts의 저장 키와 같은 값
const TOKEN_STORAGE_KEY = 'blog-manager-token'
const INVALID_MESSAGE = '로그인 정보를 확인할 수 없습니다.'

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderCallback(hash: string) {
  // 컴포넌트가 window.location.hash를 읽어도, 라우터 location.hash를 읽어도 같은 값이 보이게 둘 다 맞춘다
  window.history.replaceState(null, '', `/auth/callback${hash}`)

  return render(
    <MemoryRouter initialEntries={[`/auth/callback${hash}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/manage" element={<div>관리 화면</div>} />
        <Route path="/" element={<div>대시보드 화면</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('해시에 유효한 토큰이 있으면 sessionStorage에 토큰을 저장해야 한다', () => {
    const token = createToken(3600)

    renderCallback(`#token=${token}`)

    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token)
  })

  it('유효한 토큰이면 history.replaceState로 주소창의 해시를 제거해야 한다', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')

    renderCallback(`#token=${createToken(3600)}`)

    // renderCallback 안의 준비용 호출 이후, 컴포넌트가 해시 없는 주소로 한 번 더 호출해야 한다
    const urls = replaceState.mock.calls.map(call => String(call[2] ?? ''))
    expect(urls.slice(1).some(url => !url.includes('token'))).toBe(true)
    expect(window.location.hash).toBe('')
  })

  it('저장된 복귀 경로가 /manage이면 /manage로 이동해야 한다', () => {
    authRedirect.saveReturnPath('/manage')

    renderCallback(`#token=${createToken(3600)}`)

    expect(screen.getByText('관리 화면')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/manage')
  })

  it('저장된 복귀 경로가 없으면 /로 이동해야 한다', () => {
    renderCallback(`#token=${createToken(3600)}`)

    expect(screen.getByText('대시보드 화면')).toBeInTheDocument()
  })

  it.each([
    ['외부 URL', 'https://evil.example/x'],
    ['//로 시작하는 경로', '//evil.example'],
    ['/login', '/login'],
    ['/auth/callback', '/auth/callback'],
  ])('복귀 경로가 %s이면 /로 이동해야 한다', (_label, path) => {
    authRedirect.saveReturnPath(path)

    renderCallback(`#token=${createToken(3600)}`)

    expect(screen.getByText('대시보드 화면')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  })

  it('유효한 토큰이면 이동 후 복귀 경로 저장값이 남지 않아야 한다', () => {
    authRedirect.saveReturnPath('/manage')

    renderCallback(`#token=${createToken(3600)}`)

    // 토큰 키 외에 남은 저장값이 없어야 한다
    expect(Object.keys(sessionStorage).filter(key => key !== TOKEN_STORAGE_KEY)).toEqual([])
  })

  it('해시에 토큰이 없으면 저장하지 않고 안내 문구를 표시해야 한다', () => {
    renderCallback('')

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument()
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('토큰이 JWT 형식이 아니면 저장하지 않고 안내 문구를 표시해야 한다', () => {
    renderCallback('#token=not-a-jwt')

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument()
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('토큰이 이미 만료됐으면 저장하지 않고 안내 문구를 표시해야 한다', () => {
    renderCallback(`#token=${createToken(-100)}`)

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument()
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('토큰이 유효하지 않아도 이동하지 않고 redirectToBlogLogin도 호출하지 않아야 한다', () => {
    const redirectSpy = vi.spyOn(authRedirect, 'redirectToBlogLogin').mockImplementation(() => {})

    renderCallback('#token=not-a-jwt')

    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/callback')
    expect(redirectSpy).not.toHaveBeenCalled()
  })
})
