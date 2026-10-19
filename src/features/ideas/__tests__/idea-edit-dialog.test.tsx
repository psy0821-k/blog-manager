import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IdeaEditDialog } from '../idea-edit-dialog'
import type { SavedIdea } from '../ideas-api'

const IDEA: SavedIdea = {
  id: 'idea-1',
  title: '고칠 글감',
  memo: '- 기존 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

type DialogProps = React.ComponentProps<typeof IdeaEditDialog>

function renderDialog(props: Partial<DialogProps> = {}) {
  const onSave = vi.fn()
  const onClose = vi.fn()

  const view = render(
    <IdeaEditDialog idea={IDEA} isSaving={false} errorMessage={null} onClose={onClose} onSave={onSave} {...props} />,
  )

  const rerenderWith = (next: Partial<DialogProps>) =>
    view.rerender(
      <IdeaEditDialog idea={IDEA} isSaving={false} errorMessage={null} onClose={onClose} onSave={onSave} {...props} {...next} />,
    )

  return { onSave, onClose, rerenderWith }
}

async function findDialog() {
  return screen.findByRole('dialog')
}

describe('IdeaEditDialog', () => {
  describe('정상', () => {
    it('idea가 있으면 대화상자가 열리고 현재 제목·메모·종류가 채워져 있어야 한다', async () => {
      renderDialog()
      const dialog = await findDialog()

      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('고칠 글감')
      expect(within(dialog).getByPlaceholderText('메모')).toHaveValue('- 기존 메모')
      expect(within(dialog).getByRole('button', { name: '랩' })).toHaveAttribute('aria-pressed', 'true')
      expect(within(dialog).getByRole('button', { name: '프로젝트' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('내용을 바꾸고 저장을 누르면 공백을 뺀 제목과 메모·종류로 onSave가 한 번 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onSave } = renderDialog()
      const dialog = await findDialog()

      await user.clear(within(dialog).getByPlaceholderText('제목'))
      await user.type(within(dialog).getByPlaceholderText('제목'), '  새 제목  ')
      await user.clear(within(dialog).getByPlaceholderText('메모'))
      await user.type(within(dialog).getByPlaceholderText('메모'), '새 메모')
      await user.click(within(dialog).getByRole('button', { name: '저장' }))

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith({ title: '새 제목', memo: '새 메모', type: 'LAB' })
    })

    it('종류 버튼을 바꾸고 저장하면 바뀐 종류로 onSave가 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onSave } = renderDialog()
      const dialog = await findDialog()

      await user.click(within(dialog).getByRole('button', { name: '개발일지' }))
      await user.click(within(dialog).getByRole('button', { name: '저장' }))

      expect(onSave).toHaveBeenCalledWith({ title: '고칠 글감', memo: '- 기존 메모', type: 'DEV_LOG' })
    })

    it('취소를 누르거나 Esc를 누르면 onClose가 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDialog()
      const dialog = await findDialog()

      await user.click(within(dialog).getByRole('button', { name: '취소' }))
      expect(onClose).toHaveBeenCalledTimes(1)

      await user.keyboard('{Escape}')
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
    })
  })

  describe('경계', () => {
    it('idea가 null이면 대화상자가 열려 있지 않아야 한다', () => {
      renderDialog({ idea: null })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('제목이 공백뿐이면 저장 버튼이 비활성이고 눌러도 onSave가 호출되지 않아야 한다', async () => {
      const user = userEvent.setup()
      const { onSave } = renderDialog()
      const dialog = await findDialog()

      await user.clear(within(dialog).getByPlaceholderText('제목'))
      await user.type(within(dialog).getByPlaceholderText('제목'), '   ')

      const saveButton = within(dialog).getByRole('button', { name: '저장' })
      expect(saveButton).toBeDisabled()

      await user.click(saveButton)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('제목 maxLength 100, 메모 maxLength 2000이 있어야 한다', async () => {
      renderDialog()
      const dialog = await findDialog()

      expect(within(dialog).getByPlaceholderText('제목')).toHaveAttribute('maxLength', '100')
      expect(within(dialog).getByPlaceholderText('메모')).toHaveAttribute('maxLength', '2000')
    })

    it('메모를 모두 지우고 저장하면 memo가 빈 문자열인 채로 onSave가 호출돼야 한다', async () => {
      const user = userEvent.setup()
      const { onSave } = renderDialog()
      const dialog = await findDialog()

      await user.clear(within(dialog).getByPlaceholderText('메모'))
      await user.click(within(dialog).getByRole('button', { name: '저장' }))

      expect(onSave).toHaveBeenCalledWith({ title: '고칠 글감', memo: '', type: 'LAB' })
    })

    it('isSaving이 true이면 저장 버튼이 "저장 중…"으로 비활성이고 눌러도 onSave가 호출되지 않아야 한다', async () => {
      const user = userEvent.setup()
      const { onSave } = renderDialog({ isSaving: true })
      const dialog = await findDialog()

      const savingButton = within(dialog).getByRole('button', { name: '저장 중…' })
      expect(savingButton).toBeDisabled()

      await user.click(savingButton)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('다른 글감으로 바꿔 열면 그 글감의 값으로 채워져야 한다', async () => {
      const { rerenderWith } = renderDialog()
      await findDialog()

      rerenderWith({ idea: { ...IDEA, id: 'idea-2', title: '다른 글감', memo: '- 다른 메모', type: 'PROJECT' } })

      const dialog = await findDialog()
      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('다른 글감')
      expect(within(dialog).getByPlaceholderText('메모')).toHaveValue('- 다른 메모')
      expect(within(dialog).getByRole('button', { name: '프로젝트' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('예외', () => {
    it('errorMessage가 있으면 role="alert"로 보이고, errorMessage가 생겨도 입력한 값은 그대로 남아야 한다', async () => {
      const user = userEvent.setup()
      const { rerenderWith } = renderDialog()
      const dialog = await findDialog()
      await user.clear(within(dialog).getByPlaceholderText('제목'))
      await user.type(within(dialog).getByPlaceholderText('제목'), '고치던 제목')
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

      rerenderWith({ errorMessage: '저장하지 못했어요' })

      expect(within(await findDialog()).getByRole('alert')).toHaveTextContent('저장하지 못했어요')
      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('고치던 제목')
    })
  })
})
