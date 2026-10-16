import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NotFoundPage } from '../not-found-page'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderNotFound(initialEntry = '/dev-token') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<div>대시보드 화면</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('안내 제목과 대시보드로 돌아가기 링크가 보이고 링크 href가 /여야 한다', () => {
    renderNotFound()

    expect(screen.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '대시보드로 돌아가기' })).toHaveAttribute('href', '/')
  })

  it('링크를 누르면 /로 이동해야 한다', async () => {
    renderNotFound()

    await userEvent.setup().click(screen.getByRole('link', { name: '대시보드로 돌아가기' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(screen.getByTestId('location').textContent).toBe('/')
    expect(screen.getByText('대시보드 화면')).toBeInTheDocument()
  })
})
