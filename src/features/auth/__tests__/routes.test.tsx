import { render, screen } from '@testing-library/react'
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { saveToken } from '@/lib/auth-token'
import { router } from '@/routes'

// 로그인 이동 경계만 대체하고 나머지는 실제 구현을 쓴다
vi.mock('@/lib/auth-redirect', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth-redirect')>()),
  redirectToBlogLogin: vi.fn(),
  redirectToBlogLogout: vi.fn(),
}))

const mockedRedirect = vi.mocked(redirectToBlogLogin)

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

function getLastMatch(path: string) {
  const matches = matchRoutes(router.routes, path)
  return { matches, last: matches?.[matches.length - 1] }
}

describe('라우트 구성', () => {
  it('/dev-token은 가드 아래의 catch-all(*)에 매치되어야 한다', () => {
    const { matches, last } = getLastMatch('/dev-token')

    expect(matches).not.toBeNull()
    expect(last?.route.path).toBe('*')
    expect(matches!.length).toBeGreaterThan(1)
  })

  it('/manage는 catch-all이 아닌 /manage 라우트에 매치되어야 한다', () => {
    expect(getLastMatch('/manage').last?.route.path).toBe('/manage')
  })

  it.each(['/login', '/auth/callback'])('%s는 가드 밖 최상위 라우트로 매치되어야 한다', path => {
    const { matches, last } = getLastMatch(path)

    expect(matches).toHaveLength(1)
    expect(last?.route.path).toBe(path)
  })

  it.each(['/dev-token/', '/dev-token?x=1'])('%s도 catch-all에 매치되어야 한다', path => {
    const { matches, last } = getLastMatch(path)

    expect(matches).not.toBeNull()
    expect(last?.route.path).toBe('*')
  })
})

describe('라우트 렌더', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockedRedirect.mockClear()
    // 사이드바의 모바일 판별이 쓰는 matchMedia를 jsdom에 맞춰 대체한다
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  function renderRoutes(initialEntry: string) {
    const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [initialEntry] })

    return render(
      <TooltipProvider>
        <RouterProvider router={memoryRouter} />
      </TooltipProvider>,
    )
  }

  it('토큰이 없고 /dev-token이면 아무것도 그리지 않고 redirectToBlogLogin을 /dev-token으로 한 번 호출해야 한다', () => {
    const { container } = renderRoutes('/dev-token')

    expect(container).toBeEmptyDOMElement()
    expect(mockedRedirect).toHaveBeenCalledTimes(1)
    expect(mockedRedirect).toHaveBeenCalledWith('/dev-token')
  })

  it('토큰이 없고 임의 미등록 경로(/foo/bar?x=1)이면 그 경로로 redirectToBlogLogin을 호출해야 한다', () => {
    renderRoutes('/foo/bar?x=1')

    expect(mockedRedirect).toHaveBeenCalledWith('/foo/bar?x=1')
  })

  it('토큰이 있고 /dev-token이면 사이드바와 안내가 보이고 토큰 입력 화면과 로그인 이동은 없어야 한다', () => {
    saveToken(createToken(3600))

    renderRoutes('/dev-token')

    expect(screen.getByText('blogManager')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    expect(screen.queryByText('개발용 토큰')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /저장|삭제/ })).not.toBeInTheDocument()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('토큰이 있고 /todo이면 오늘 할 일 화면이 보이고 안내는 없어야 한다', () => {
    saveToken(createToken(3600))

    renderRoutes('/todo')

    expect(screen.getByRole('heading', { name: '오늘 할 일' })).toBeInTheDocument()
    expect(screen.queryByText('페이지를 찾을 수 없습니다')).not.toBeInTheDocument()
  })

  it('토큰이 있고 /login이면 가드 밖이라 LoginPage가 그려지고 안내는 없어야 한다', () => {
    saveToken(createToken(3600))

    renderRoutes('/login?loggedOut=1')

    expect(screen.getByText('로그아웃되었습니다.')).toBeInTheDocument()
    expect(screen.queryByText('페이지를 찾을 수 없습니다')).not.toBeInTheDocument()
  })
})
