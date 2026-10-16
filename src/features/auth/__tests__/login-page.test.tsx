import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirectToBlogLogin } from '@/lib/auth-redirect'
import { LoginPage } from '../login-page'

vi.mock('@/lib/auth-redirect', () => ({ redirectToBlogLogin: vi.fn() }))

const mockedRedirect = vi.mocked(redirectToBlogLogin)

function Wrapped() {
  return (
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockedRedirect.mockClear()
  })

  it('렌더링하면 화면에 아무것도 그리지 않고 redirectToBlogLogin("/")을 호출해야 한다', () => {
    const { container } = render(<Wrapped />)

    expect(container).toBeEmptyDOMElement()
    expect(mockedRedirect).toHaveBeenCalledWith('/')
  })

  it('loggedOut=1이면 자동으로 이동하지 않고 다시 로그인 버튼을 보여야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/login?loggedOut=1']}>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: '다시 로그인' })).toBeInTheDocument()
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('다시 로그인 버튼을 누르면 redirectToBlogLogin("/")을 호출해야 한다', async () => {
    render(
      <MemoryRouter initialEntries={['/login?loggedOut=1']}>
        <LoginPage />
      </MemoryRouter>,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(mockedRedirect).toHaveBeenCalledWith('/')
  })

  it('리렌더링되어도 redirectToBlogLogin은 한 번만 호출되어야 한다', () => {
    const { rerender } = render(<Wrapped />)

    rerender(<Wrapped />)

    expect(mockedRedirect).toHaveBeenCalledTimes(1)
  })

  describe('error 쿼리가 있을 때', () => {
    function renderWithQuery(query: string) {
      const ui = (
        <MemoryRouter initialEntries={[`/login${query}`]}>
          <LoginPage />
        </MemoryRouter>
      )
      return { ui, ...render(ui) }
    }

    it('invalid-token이면 안내 문구와 다시 로그인 버튼을 보여야 한다', () => {
      renderWithQuery('?error=invalid-token')

      expect(screen.getByText('로그인 정보를 확인할 수 없습니다.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다시 로그인' })).toBeInTheDocument()
    })

    it('access-denied이면 관리자 계정 안내 문구를 보여야 한다', () => {
      renderWithQuery('?error=access-denied')

      expect(screen.getByText('관리자 계정으로만 로그인할 수 있습니다.')).toBeInTheDocument()
    })

    it('렌더링 직후 redirectToBlogLogin을 호출하지 않아야 한다', () => {
      renderWithQuery('?error=invalid-token')

      expect(mockedRedirect).not.toHaveBeenCalled()
    })

    it('리렌더링해도 redirectToBlogLogin을 호출하지 않아야 한다', () => {
      const { rerender, ui } = renderWithQuery('?error=invalid-token')

      rerender(ui)

      expect(mockedRedirect).not.toHaveBeenCalled()
    })

    it('다시 로그인 버튼을 누르면 redirectToBlogLogin("/")을 한 번 호출해야 한다', async () => {
      renderWithQuery('?error=invalid-token')

      await userEvent.setup().click(screen.getByRole('button', { name: '다시 로그인' }))

      expect(mockedRedirect).toHaveBeenCalledTimes(1)
      expect(mockedRedirect).toHaveBeenCalledWith('/')
    })

    it('알 수 없는 코드이면 일반 문구를 보이고 코드 문자열은 화면에 없어야 한다', () => {
      renderWithQuery('?error=weird')

      expect(screen.getByText('로그인에 실패했습니다. 다시 시도해 주세요.')).toBeInTheDocument()
      expect(screen.queryByText(/weird/)).not.toBeInTheDocument()
    })

    it('빈 값이어도 자동 이동하지 않고 일반 문구와 버튼을 보여야 한다', () => {
      renderWithQuery('?error=')

      expect(screen.getByText('로그인에 실패했습니다. 다시 시도해 주세요.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다시 로그인' })).toBeInTheDocument()
      expect(mockedRedirect).not.toHaveBeenCalled()
    })

    it('loggedOut=1이 함께 있으면 오류 문구만 보이고 자동 이동하지 않아야 한다', () => {
      renderWithQuery('?error=access-denied&loggedOut=1')

      expect(screen.getByText('관리자 계정으로만 로그인할 수 있습니다.')).toBeInTheDocument()
      expect(screen.queryByText('로그아웃되었습니다.')).not.toBeInTheDocument()
      expect(mockedRedirect).not.toHaveBeenCalled()
    })
  })
})
