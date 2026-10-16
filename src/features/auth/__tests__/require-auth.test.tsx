import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { saveToken } from '@/lib/auth-token'
import { AppLayout } from '@/layouts/app-layout'
import { RequireAuth } from '../require-auth'

vi.mock('@/lib/auth-redirect', () => ({ redirectToBlogLogin: vi.fn() }))

const mockedRedirect = vi.mocked(redirectToBlogLogin)

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

function GuardedRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/manage" element={<div>관리 화면</div>} />
      </Route>
    </Routes>
  )
}

function renderGuard(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GuardedRoutes />
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockedRedirect.mockClear()
  })

  it('유효한 토큰이 있으면 자식 라우트를 그리고 redirectToBlogLogin을 호출하지 않아야 한다', () => {
    saveToken(createToken(3600))

    renderGuard('/manage')

    expect(screen.getByText('관리 화면')).toBeInTheDocument()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('토큰이 없으면 아무것도 그리지 않고 redirectToBlogLogin을 현재 경로로 호출해야 한다', () => {
    const { container } = renderGuard('/manage')

    expect(container).toBeEmptyDOMElement()
    expect(mockedRedirect).toHaveBeenCalledWith('/manage')
  })

  it('토큰이 없고 주소가 /manage?page=2이면 쿼리를 포함한 경로로 호출해야 한다', () => {
    renderGuard('/manage?page=2')

    expect(mockedRedirect).toHaveBeenCalledWith('/manage?page=2')
  })

  it('토큰이 없을 때 리렌더링되어도 redirectToBlogLogin은 한 번만 호출되어야 한다', () => {
    const { rerender } = renderGuard('/manage')

    rerender(
      <MemoryRouter initialEntries={['/manage']}>
        <GuardedRoutes />
      </MemoryRouter>,
    )

    expect(mockedRedirect).toHaveBeenCalledTimes(1)
  })

  it('토큰이 만료 임박(30초 이내)이면 토큰이 없는 것과 같이 처리해야 한다', () => {
    saveToken(createToken(10))

    renderGuard('/manage')

    expect(screen.queryByText('관리 화면')).not.toBeInTheDocument()
    expect(mockedRedirect).toHaveBeenCalledWith('/manage')
  })

  it('토큰이 이미 만료됐으면 토큰이 없는 것과 같이 처리해야 한다', () => {
    saveToken(createToken(-100))

    renderGuard('/manage')

    expect(screen.queryByText('관리 화면')).not.toBeInTheDocument()
    expect(mockedRedirect).toHaveBeenCalledWith('/manage')
  })
})

describe('RequireAuth와 AppLayout 구성', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockedRedirect.mockClear()
  })

  function renderGuardedLayout(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<div>대시보드 화면</div>} />
              <Route path="/manage" element={<div>관리 화면</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('토큰이 없으면 사이드바 등 레이아웃 요소가 DOM에 없어야 한다', () => {
    renderGuardedLayout('/manage')

    expect(screen.queryByText('blogManager')).not.toBeInTheDocument()
    expect(screen.queryByText('관리 화면')).not.toBeInTheDocument()
  })

  it('토큰이 있고 /와 /manage를 오가도 redirectToBlogLogin이 호출되지 않고 각 화면이 표시되어야 한다', async () => {
    saveToken(createToken(3600))
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route
              element={
                <div>
                  <Link to="/">홈 이동</Link>
                  <Link to="/manage">관리 이동</Link>
                  <Outlet />
                </div>
              }
            >
              <Route path="/" element={<div>대시보드 화면</div>} />
              <Route path="/manage" element={<div>관리 화면</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('대시보드 화면')).toBeInTheDocument()
    await user.click(screen.getByText('관리 이동'))
    expect(screen.getByText('관리 화면')).toBeInTheDocument()
    await user.click(screen.getByText('홈 이동'))
    expect(screen.getByText('대시보드 화면')).toBeInTheDocument()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })
})
