import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { AuthCallbackPage } from '../auth-callback-page'
import { LoginPage } from '../login-page'

// redirectToBlogLogin만 대체하고 나머지(readTokenFromHash, takeReturnPath)는 실제 구현을 쓴다
vi.mock('@/lib/auth-redirect', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth-redirect')>()),
  redirectToBlogLogin: vi.fn(),
}))

const mockedRedirect = vi.mocked(redirectToBlogLogin)

// auth-token.ts의 저장 키와 같은 값
const TOKEN_STORAGE_KEY = 'blog-manager-token'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderCallbackWithInvalidToken() {
  const hash = '#token=not-a-jwt'
  window.history.replaceState(null, '', `/auth/callback${hash}`)

  return render(
    <MemoryRouter initialEntries={[`/auth/callback${hash}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
}

describe('잘못된 토큰으로 /auth/callback에 들어가면', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockedRedirect.mockClear()
  })

  it('/login 오류 안내와 다시 로그인 버튼이 보이고 토큰은 저장되지 않아야 한다', () => {
    renderCallbackWithInvalidToken()

    expect(screen.getByTestId('location')).toHaveTextContent('/login?error=invalid-token')
    expect(screen.getByText('로그인 정보를 확인할 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 로그인' })).toBeInTheDocument()
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('redirectToBlogLogin은 버튼을 누르기 전에는 호출되지 않고 누르면 "/"로 호출되어야 한다', async () => {
    renderCallbackWithInvalidToken()

    // 오류 화면이 떠 있어야 "호출 안 됨"이 의미 있다
    const button = await screen.findByRole('button', { name: '다시 로그인' })
    expect(mockedRedirect).not.toHaveBeenCalled()

    await userEvent.setup().click(button)

    expect(mockedRedirect).toHaveBeenCalledTimes(1)
    expect(mockedRedirect).toHaveBeenCalledWith('/')
  })
})
