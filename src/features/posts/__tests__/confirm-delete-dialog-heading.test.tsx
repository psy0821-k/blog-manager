import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDeleteDialog } from '../confirm-delete-dialog'

function renderDialog({ heading, isPending = false }: { heading?: string; isPending?: boolean } = {}) {
  render(
    <ConfirmDeleteDialog
      title="첫 글감"
      heading={heading}
      isPending={isPending}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
}

describe('ConfirmDeleteDialog heading과 스피너', () => {
  it('heading을 넘기면 대화상자 이름이 그 값이어야 한다', async () => {
    renderDialog({ heading: '글감 삭제' })

    expect(await screen.findByRole('dialog', { name: '글감 삭제' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '글 삭제' })).not.toBeInTheDocument()
  })

  it('isPending이 true이면 role="status" "삭제 중" 로딩 스피너가 보여야 한다', async () => {
    renderDialog({ isPending: true })
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('status', { name: '삭제 중' })).toBeInTheDocument()
  })

  it('heading을 생략하면 지금처럼 "글 삭제"여야 한다', async () => {
    renderDialog()

    expect(await screen.findByRole('dialog', { name: '글 삭제' })).toBeInTheDocument()
  })

  it('isPending이 false이면 로딩 스피너가 없어야 한다', async () => {
    renderDialog({ isPending: false })
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument()
  })

  it('isPending이 true여도 삭제 버튼의 이름은 "삭제 중…" 그대로여야 한다', async () => {
    renderDialog({ isPending: true })
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('button', { name: '삭제 중…' })).toBeDisabled()
  })
})
