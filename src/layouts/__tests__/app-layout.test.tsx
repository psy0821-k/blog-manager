import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@/features/auth/login-page'
import { getToken, saveToken } from '@/lib/auth-token'
import { AppLayout } from '../app-layout'

vi.mock('@/lib/auth-redirect', () => ({ redirectToBlogLogin: vi.fn() }))

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

function renderLayout() {
  // 앱은 App.tsx에서 TooltipProvider로 감싸므로 테스트도 같게 맞춘다
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>대시보드 화면</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
}

describe('AppLayout 로그아웃', () => {
  beforeEach(() => {
    sessionStorage.clear()
    saveToken(createToken(3600))
    // 사이드바의 모바일 판별이 쓰는 matchMedia를 jsdom에 맞춰 대체한다
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  it('헤더에 로그인 상태와 로그아웃 버튼이 보여야 한다', () => {
    renderLayout()

    expect(screen.getByText(/관리자 님 반갑습니다/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()
  })

  it('로그아웃을 누르면 토큰이 삭제되고 다시 로그인 버튼이 있는 화면으로 이동해야 한다', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(getToken()).toBeNull()
    expect(screen.getByRole('button', { name: '다시 로그인' })).toBeInTheDocument()
    expect(screen.queryByText('대시보드 화면')).not.toBeInTheDocument()
  })
})
