import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdeaDetailDialog } from '../idea-detail-dialog'
import type { SavedIdea } from '../ideas-api'

const IDEA: SavedIdea = {
  id: 'idea-1',
  title: '상세로 볼 글감',
  memo: '- 첫 번째 메모\n- 두 번째 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

function renderDialog(idea: SavedIdea | null = IDEA) {
  const onClose = vi.fn()

  render(<IdeaDetailDialog idea={idea} onClose={onClose} />)

  return { onClose }
}

describe('IdeaDetailDialog', () => {
  describe('정상', () => {
    it('idea가 있으면 대화상자가 열리고 제목, 메모 전문, 종류, 상태, 등록일이 보여야 한다', async () => {
      renderDialog()

      const dialog = await screen.findByRole('dialog')

      expect(within(dialog).getByText('상세로 볼 글감')).toBeInTheDocument()
      expect(within(dialog).getByText(/첫 번째 메모/)).toBeInTheDocument()
      expect(within(dialog).getByText(/두 번째 메모/)).toBeInTheDocument()
      expect(within(dialog).getByText('랩')).toBeInTheDocument()
      expect(within(dialog).getByText('진행')).toBeInTheDocument()
      expect(within(dialog).getByText(new Date(IDEA.createdAt).toLocaleDateString('ko-KR'))).toBeInTheDocument()
    })

    it('닫기 버튼을 누르면 onClose를 호출해야 한다', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDialog()
      const dialog = await screen.findByRole('dialog')

      await user.click(within(dialog).getAllByRole('button', { name: /닫기|Close/ })[0])

      expect(onClose).toHaveBeenCalled()
    })

    it('Esc를 누르면 onClose를 호출해야 한다', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDialog()
      await screen.findByRole('dialog')

      await user.keyboard('{Escape}')

      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })
  })

  describe('경계', () => {
    it('idea가 null이면 대화상자가 열려 있지 않아야 한다', () => {
      renderDialog(null)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('메모가 빈 문자열이면 메모 없음 안내가 보여야 한다', async () => {
      renderDialog({ ...IDEA, memo: '' })

      const dialog = await screen.findByRole('dialog')

      expect(within(dialog).getByText('메모가 없습니다.')).toBeInTheDocument()
    })

    it('메모가 여러 줄이면 줄바꿈을 유지해 보여야 한다', async () => {
      renderDialog()
      const dialog = await screen.findByRole('dialog')

      const memo = within(dialog).getByText(/첫 번째 메모/)

      expect(memo.textContent).toBe(IDEA.memo)
      expect(memo).toHaveClass('whitespace-pre-wrap')
    })
  })
})
