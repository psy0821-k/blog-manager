import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdeaTable } from '../idea-table'
import type { SavedIdea } from '../ideas-api'

const TODO_IDEA: SavedIdea = {
  id: 'idea-1',
  title: '대기 글감',
  memo: '- 메모 1',
  type: 'PROJECT',
  status: 'todo',
  createdAt: '2026-10-19T00:00:00.000Z',
}

const DOING_IDEA: SavedIdea = {
  id: 'idea-2',
  title: '진행 글감',
  memo: '',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-18T00:00:00.000Z',
}

function renderTable({ pendingIds = [] as string[], withRowStatus = true } = {}) {
  const onSelect = vi.fn()
  const onChange = vi.fn()
  const isPending = (id: string) => pendingIds.includes(id)

  render(
    <IdeaTable
      ideas={[TODO_IDEA, DOING_IDEA]}
      onSelect={onSelect}
      rowStatus={withRowStatus ? { isPending, onChange } : undefined}
    />,
  )

  return { onSelect, onChange }
}

function rowOf(title: string) {
  return screen.getByRole('row', { name: new RegExp(title) })
}

describe('IdeaTable rowStatus', () => {
  describe('정상', () => {
    it('각 행에 대기·진행·완료 버튼이 있고 현재 상태 버튼만 aria-pressed=true여야 한다', () => {
      renderTable()

      const todoRow = rowOf('대기 글감')
      expect(within(todoRow).getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'true')
      expect(within(todoRow).getByRole('button', { name: '진행' })).toHaveAttribute('aria-pressed', 'false')
      expect(within(todoRow).getByRole('button', { name: '완료' })).toHaveAttribute('aria-pressed', 'false')

      const doingRow = rowOf('진행 글감')
      expect(within(doingRow).getByRole('button', { name: '진행' })).toHaveAttribute('aria-pressed', 'true')
      expect(within(doingRow).getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('다른 상태 버튼을 누르면 (idea, 그 상태)로 onChange를 한 번 호출해야 한다', async () => {
      const user = userEvent.setup()
      const { onChange } = renderTable()

      await user.click(within(rowOf('대기 글감')).getByRole('button', { name: '진행' }))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(TODO_IDEA, 'doing')
    })
  })

  describe('경계', () => {
    it('상태 버튼을 눌러도 onSelect는 호출되지 않아야 한다', async () => {
      const user = userEvent.setup()
      const { onSelect } = renderTable()

      await user.click(within(rowOf('대기 글감')).getByRole('button', { name: '완료' }))

      expect(onSelect).not.toHaveBeenCalled()
    })

    it('상태 버튼에 포커스를 두고 Enter를 눌러도 onSelect는 호출되지 않아야 한다', async () => {
      const user = userEvent.setup()
      const { onSelect, onChange } = renderTable()
      const button = within(rowOf('대기 글감')).getByRole('button', { name: '진행' })

      button.focus()
      await user.keyboard('{Enter}')

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('isPending(id)가 true인 행의 버튼은 비활성이고 다른 행은 활성이어야 한다', () => {
      renderTable({ pendingIds: ['idea-1'] })

      for (const name of ['대기', '진행', '완료']) {
        expect(within(rowOf('대기 글감')).getByRole('button', { name })).toBeDisabled()
        expect(within(rowOf('진행 글감')).getByRole('button', { name })).toBeEnabled()
      }
    })

    it('행에 포커스를 두고 Enter를 누르면 여전히 onSelect가 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onSelect } = renderTable()

      rowOf('대기 글감').focus()
      await user.keyboard('{Enter}')

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(TODO_IDEA)
    })

    it('rowStatus가 없으면 지금처럼 상태 라벨만 보이고 버튼은 없어야 한다', () => {
      renderTable({ withRowStatus: false })

      expect(within(rowOf('대기 글감')).getByText('대기')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
