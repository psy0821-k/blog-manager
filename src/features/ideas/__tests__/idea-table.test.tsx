import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdeaTable } from '../idea-table'
import type { SavedIdea } from '../ideas-api'

const FIRST: SavedIdea = {
  id: 'idea-1',
  title: '첫 번째 글감',
  memo: '- 메모 1',
  type: 'PROJECT',
  status: 'todo',
  createdAt: '2026-10-19T00:00:00.000Z',
}

const SECOND: SavedIdea = {
  id: 'idea-2',
  title: '두 번째 글감',
  memo: '',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-18T00:00:00.000Z',
}

const THIRD: SavedIdea = {
  id: 'idea-3',
  title: '세 번째 글감',
  memo: '- 메모 3',
  type: 'DEV_LOG',
  status: 'done',
  createdAt: '2026-10-17T00:00:00.000Z',
}

function renderTable(ideas: SavedIdea[] = [FIRST, SECOND, THIRD]) {
  const onSelect = vi.fn()

  render(<IdeaTable ideas={ideas} onSelect={onSelect} />)

  return { onSelect }
}

describe('IdeaTable', () => {
  describe('정상', () => {
    it('글감마다 제목, 종류 라벨, 상태 라벨을 행으로 보여야 한다', () => {
      renderTable()

      const firstRow = screen.getByRole('row', { name: /첫 번째 글감/ })
      expect(within(firstRow).getByText('프로젝트')).toBeInTheDocument()
      expect(within(firstRow).getByText('대기')).toBeInTheDocument()

      const secondRow = screen.getByRole('row', { name: /두 번째 글감/ })
      expect(within(secondRow).getByText('랩')).toBeInTheDocument()
      expect(within(secondRow).getByText('진행')).toBeInTheDocument()

      const thirdRow = screen.getByRole('row', { name: /세 번째 글감/ })
      expect(within(thirdRow).getByText('개발일지')).toBeInTheDocument()
      expect(within(thirdRow).getByText('완료')).toBeInTheDocument()
    })

    it('행을 누르면 그 글감으로 onSelect를 한 번 호출해야 한다', async () => {
      const user = userEvent.setup()
      const { onSelect } = renderTable()

      await user.click(screen.getByText('두 번째 글감'))

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(SECOND)
    })
  })

  describe('경계', () => {
    it('전달받은 순서를 그대로 보여야 한다', () => {
      renderTable([THIRD, FIRST, SECOND])

      const titles = screen
        .getAllByRole('row')
        .slice(1) // 머리글 행 제외
        .map((row) => within(row).getAllByRole('cell')[0].textContent)

      expect(titles).toEqual(['세 번째 글감', '첫 번째 글감', '두 번째 글감'])
    })

    it('키보드로 행에 포커스를 옮기고 Enter를 누르면 그 글감으로 onSelect를 호출해야 한다', async () => {
      const user = userEvent.setup()
      const { onSelect } = renderTable([FIRST, SECOND])

      await user.tab()
      await user.keyboard('{Enter}')

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(FIRST)
    })
  })
})
