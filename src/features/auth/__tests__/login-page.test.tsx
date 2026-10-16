import { render } from '@testing-library/react'
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

  it('리렌더링되어도 redirectToBlogLogin은 한 번만 호출되어야 한다', () => {
    const { rerender } = render(<Wrapped />)

    rerender(<Wrapped />)

    expect(mockedRedirect).toHaveBeenCalledTimes(1)
  })
})
