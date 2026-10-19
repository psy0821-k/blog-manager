import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { IdeasPage } from '../ideas-page'

vi.mock('@/lib/auth-redirect', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-redirect')>()),
  redirectToBlogLogin: vi.fn(),
  isReloginLooping: () => false,
}))

const TOKEN_STORAGE_KEY = 'blog-manager-token'
const mockedRedirectToBlogLogin = vi.mocked(redirectToBlogLogin)

/** payload에 exp(초)만 가진, 만료가 먼 JWT */
function createToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

describe('IdeasPage 401/403 재로그인 통합', () => {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>()

  function ideaUrls(): string[] {
    return fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/ideas'))
  }

  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem(TOKEN_STORAGE_KEY, createToken())
    mockedRedirectToBlogLogin.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([401, 403])('글감 목록 요청이 %i이면 토큰을 지운 뒤 재로그인을 시작해야 한다', async (status) => {
    fetchMock.mockImplementation(async () => new Response('{}', { status }))

    render(
      <MemoryRouter initialEntries={['/ideas?status=doing']}>
        <IdeasPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1))
    expect(ideaUrls().some((url) => url.endsWith('/ideas?status=doing'))).toBe(true)
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })
})
