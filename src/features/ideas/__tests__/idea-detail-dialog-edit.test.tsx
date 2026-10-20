import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdeaDetailDialog } from '../idea-detail-dialog'
import type { SavedIdea } from '../ideas-api'

const IDEA: SavedIdea = {
  id: 'idea-1',
  title: '상세로 볼 글감',
  memo: '- 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

describe('IdeaDetailDialog onEdit', () => {
  it('onEdit이 있으면 "수정" 버튼이 보이고 누르면 그 글감으로 onEdit을 호출해야 한다', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<IdeaDetailDialog idea={IDEA} onClose={vi.fn()} onEdit={onEdit} />)
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: '수정' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith(IDEA)
  })

  it('onEdit이 없으면 "수정" 버튼이 없어야 한다', async () => {
    render(<IdeaDetailDialog idea={IDEA} onClose={vi.fn()} />)
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).queryByRole('button', { name: '수정' })).not.toBeInTheDocument()
  })
})
