import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDeleteDialog } from '../confirm-delete-dialog'

const TITLE = '첫 글'
const PENDING_LABEL = '삭제 중…'

function renderDialog({ title = TITLE as string | null, isPending = false } = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()

  render(<ConfirmDeleteDialog title={title} isPending={isPending} onConfirm={onConfirm} onCancel={onCancel} />)

  return { onConfirm, onCancel }
}

describe('ConfirmDeleteDialog', () => {
  describe('정상', () => {
    it('title이 있으면 글 삭제 대화상자가 열리고 확인 문구와 취소, 삭제 버튼이 보여야 한다', async () => {
      renderDialog()

      const dialog = await screen.findByRole('dialog', { name: '글 삭제' })

      expect(within(dialog).getByText('「첫 글」을 삭제할까요? 되돌릴 수 없습니다.')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: '취소' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: '삭제' })).toBeInTheDocument()
    })

    it('삭제를 누르면 onConfirm이, 취소를 누르면 onCancel이 한 번씩 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onConfirm, onCancel } = renderDialog()
      const dialog = await screen.findByRole('dialog')

      await user.click(within(dialog).getByRole('button', { name: '삭제' }))

      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onCancel).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: '취소' }))

      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('열리면 포커스가 취소 버튼에 있어야 한다', async () => {
      renderDialog()
      const dialog = await screen.findByRole('dialog')

      await waitFor(() => expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus())
    })
  })

  describe('경계', () => {
    it('title이 null이면 대화상자가 렌더되지 않아야 한다', () => {
      renderDialog({ title: null })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('isPending이 true이면 삭제 중… 과 취소가 disabled이고 Esc를 눌러도 onCancel이 호출되지 않으며 닫기 X 버튼이 없어야 한다', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog({ isPending: true })
      const dialog = await screen.findByRole('dialog')

      expect(within(dialog).getByRole('button', { name: PENDING_LABEL })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: '취소' })).toBeDisabled()
      expect(within(dialog).queryByRole('button', { name: /닫기|close/i })).not.toBeInTheDocument()

      await user.keyboard('{Escape}')

      expect(onCancel).not.toHaveBeenCalled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('isPending이 false일 때 Esc를 누르면 onCancel이 한 번 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderDialog()
      await screen.findByRole('dialog')

      await user.keyboard('{Escape}')

      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })
})
