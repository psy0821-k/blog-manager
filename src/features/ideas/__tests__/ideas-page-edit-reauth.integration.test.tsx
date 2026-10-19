import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const IDEA = {
  id: '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c',
  title: '고칠 글감',
  memo: '- 메모',
  type: 'LAB',
  status: 'todo',
  createdAt: '2026-10-19T00:00:00.000Z',
}

/** payload에 exp(초)만 가진, 만료가 먼 JWT */
function createToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

describe('IdeasPage 추가·수정 401/403 재로그인 통합', () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/ideas']}>
        <IdeasPage />
      </MemoryRouter>,
    )
  }

  function failWrites(method: string, status: number) {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === method
        ? new Response('{}', { status })
        : new Response(JSON.stringify({ data: [IDEA] }), { status: 200 }),
    )
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

  it.each([401, 403])('빠른 추가의 POST가 %i이면 토큰을 지운 뒤 재로그인을 시작해야 한다', async (status) => {
    const user = userEvent.setup()
    failWrites('POST', status)
    renderPage()
    await screen.findByText('고칠 글감')

    await user.type(screen.getByPlaceholderText('제목'), '새 글감')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1))
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({ title: '새 글감', memo: '', type: 'DEV_LOG' })
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it.each([401, 403])('수정 저장의 PATCH가 %i이면 토큰을 지운 뒤 재로그인을 시작해야 한다', async (status) => {
    const user = userEvent.setup()
    failWrites('PATCH', status)
    renderPage()
    await user.click(await screen.findByText('고칠 글감'))
    const detail = await screen.findByRole('dialog')
    await user.click(within(detail).getByRole('button', { name: '수정' }))
    const edit = await screen.findByRole('dialog')

    await user.click(within(edit).getByRole('button', { name: '저장' }))

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1))
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(String(patchCall?.[0])).toContain(`/ideas/${IDEA.id}`)
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })
})
