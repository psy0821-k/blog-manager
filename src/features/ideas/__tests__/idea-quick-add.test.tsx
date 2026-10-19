import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdeaQuickAdd } from '../idea-quick-add'
import type { SavedIdea } from '../ideas-api'

const SAVED: SavedIdea = {
  id: 'idea-1',
  title: '새 글감',
  memo: '',
  type: 'DEV_LOG',
  status: 'todo',
  createdAt: '2026-10-19T00:00:00.000Z',
}

function renderQuickAdd({
  isSaving = false,
  errorMessage = null as string | null,
  result = SAVED as SavedIdea | null,
} = {}) {
  const onAdd = vi.fn(async () => result)

  render(<IdeaQuickAdd isSaving={isSaving} errorMessage={errorMessage} onAdd={onAdd} />)

  return { onAdd }
}

function titleInput() {
  return screen.getByPlaceholderText('제목')
}

describe('IdeaQuickAdd', () => {
  describe('정상', () => {
    it('제목을 입력하고 종류를 고른 뒤 추가를 누르면 onAdd({ title, memo: "", type })이 한 번 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onAdd } = renderQuickAdd()

      await user.type(titleInput(), '새 글감')
      await user.click(screen.getByRole('button', { name: '랩' }))
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(onAdd).toHaveBeenCalledTimes(1)
      expect(onAdd).toHaveBeenCalledWith({ title: '새 글감', memo: '', type: 'LAB' })
    })

    it('제목 입력창에서 Enter를 누르면 추가 버튼과 같이 onAdd가 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onAdd } = renderQuickAdd()

      await user.type(titleInput(), '엔터로 추가{Enter}')

      expect(onAdd).toHaveBeenCalledTimes(1)
      expect(onAdd).toHaveBeenCalledWith({ title: '엔터로 추가', memo: '', type: 'DEV_LOG' })
    })

    it('종류를 고르지 않으면 개발일지가 기본으로 선택돼 전달돼야 한다', async () => {
      const user = userEvent.setup()
      const { onAdd } = renderQuickAdd()

      expect(screen.getByRole('button', { name: '개발일지' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '프로젝트' })).toHaveAttribute('aria-pressed', 'false')

      await user.type(titleInput(), '기본 종류')
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(onAdd).toHaveBeenCalledWith({ title: '기본 종류', memo: '', type: 'DEV_LOG' })
    })

    it('onAdd가 글감을 반환하면(성공) 제목 입력창이 비워지고 선택한 종류는 유지돼야 한다', async () => {
      const user = userEvent.setup()
      renderQuickAdd()

      await user.click(screen.getByRole('button', { name: '프로젝트' }))
      await user.type(titleInput(), '성공할 글감')
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(titleInput()).toHaveValue('')
      expect(screen.getByRole('button', { name: '프로젝트' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('경계', () => {
    it('제목 앞뒤 공백은 제거한 값이 전달돼야 한다', async () => {
      const user = userEvent.setup()
      const { onAdd } = renderQuickAdd()

      await user.type(titleInput(), '  공백 있는 제목  ')
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(onAdd).toHaveBeenCalledWith({ title: '공백 있는 제목', memo: '', type: 'DEV_LOG' })
    })

    it('제목이 비었거나 공백뿐이면 추가 버튼이 비활성이고 Enter를 눌러도 onAdd가 호출되지 않아야 한다', async () => {
      const user = userEvent.setup()
      const { onAdd } = renderQuickAdd()

      expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()

      await user.type(titleInput(), '   {Enter}')

      expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
      expect(onAdd).not.toHaveBeenCalled()
    })

    it('제목 입력창에 maxLength 100이 있어 100자를 넘게 입력할 수 없어야 한다', async () => {
      const user = userEvent.setup()
      renderQuickAdd()

      expect(titleInput()).toHaveAttribute('maxLength', '100')

      await user.type(titleInput(), 'a'.repeat(120))

      expect((titleInput() as HTMLInputElement).value).toHaveLength(100)
    })

    it('isSaving이 true이면 추가 버튼이 "추가 중…"으로 비활성이어야 한다', () => {
      renderQuickAdd({ isSaving: true })

      expect(screen.getByRole('button', { name: '추가 중…' })).toBeDisabled()
    })
  })

  describe('예외', () => {
    it('onAdd가 null을 반환하면(실패) 입력한 제목이 그대로 남아야 한다', async () => {
      const user = userEvent.setup()
      renderQuickAdd({ result: null })

      await user.type(titleInput(), '실패할 글감')
      await user.click(screen.getByRole('button', { name: '추가' }))

      expect(titleInput()).toHaveValue('실패할 글감')
    })

    it('errorMessage가 있으면 role="alert"로 보이고, 없으면 알림이 없어야 한다', () => {
      const { unmount } = render(<IdeaQuickAdd isSaving={false} errorMessage={null} onAdd={vi.fn()} />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      unmount()

      render(<IdeaQuickAdd isSaving={false} errorMessage="추가하지 못했어요" onAdd={vi.fn()} />)
      expect(screen.getByRole('alert')).toHaveTextContent('추가하지 못했어요')
    })
  })
})
