import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { IdeaDraft } from '../dashboard-mock';
import { IdeaSaveDialog } from '../idea-save-dialog';

const DRAFT: IdeaDraft = { title: '제목', memo: '- 메모', type: 'LAB' };

function renderDialog({ draft = DRAFT, isSaving = false } = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();

  render(<IdeaSaveDialog draft={draft} isSaving={isSaving} onClose={onClose} onSave={onSave} />);

  return { onSave, onClose };
}

async function findDialog() {
  return screen.findByRole('dialog', { name: '대화 내용을 글감으로 저장' });
}

describe('IdeaSaveDialog', () => {
  describe('정상', () => {
    it('isSaving이 false이고 제목이 있으면 저장 버튼이 활성이고, 누르면 공백을 뺀 제목과 메모·종류로 onSave가 한 번 호출돼야 한다', async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog({ draft: { ...DRAFT, title: '  제목  ' } });
      const dialog = await findDialog();
      const saveButton = within(dialog).getByRole('button', { name: '저장' });

      expect(saveButton).toBeEnabled();

      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ title: '제목', memo: '- 메모', type: 'LAB' });
    });

    it('isSaving이 true이면 저장 버튼이 비활성이고 "저장 중…"이 보이며 눌러도 onSave가 호출되지 않아야 한다', async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog({ isSaving: true });
      const dialog = await findDialog();
      const savingButton = within(dialog).getByRole('button', { name: '저장 중…' });

      expect(savingButton).toBeDisabled();

      await user.click(savingButton);

      expect(onSave).not.toHaveBeenCalled();
    });

    it('종류 버튼을 바꾸고 저장하면 바뀐 종류로 onSave가 호출돼야 한다', async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog();
      const dialog = await findDialog();

      await user.click(within(dialog).getByRole('button', { name: '개발일지' }));
      await user.click(within(dialog).getByRole('button', { name: '저장' }));

      expect(onSave).toHaveBeenCalledWith({ title: '제목', memo: '- 메모', type: 'DEV_LOG' });
    });

    it('취소를 누르면 onClose가 호출돼야 한다', async () => {
      const user = userEvent.setup();
      const { onClose } = renderDialog();
      const dialog = await findDialog();

      await user.click(within(dialog).getByRole('button', { name: '취소' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('경계', () => {
    it('제목이 공백뿐이면 저장 버튼이 비활성이고 onSave가 호출되지 않아야 한다', async () => {
      const user = userEvent.setup();
      const { onSave } = renderDialog({ draft: { ...DRAFT, title: '   ' } });
      const dialog = await findDialog();
      const saveButton = within(dialog).getByRole('button', { name: '저장' });

      expect(saveButton).toBeDisabled();

      await user.click(saveButton);

      expect(onSave).not.toHaveBeenCalled();
    });

    it('제목 입력이 100자에 도달하면 더 입력해도 100자를 넘지 않아야 한다', async () => {
      const user = userEvent.setup();
      renderDialog();
      const dialog = await findDialog();
      const titleInput = within(dialog).getByPlaceholderText('제목');

      await user.clear(titleInput);
      await user.type(titleInput, 'a'.repeat(105));

      expect(titleInput).toHaveValue('a'.repeat(100));
    });

    it('메모 입력의 최대 길이가 2000자여야 한다', async () => {
      renderDialog();
      const dialog = await findDialog();

      expect(within(dialog).getByPlaceholderText('메모')).toHaveAttribute('maxlength', '2000');
    });

    it('초안 제목이 100자를 넘어도 자르지 않고 그대로 보여야 한다', async () => {
      const longTitle = 'a'.repeat(120);
      renderDialog({ draft: { ...DRAFT, title: longTitle } });
      const dialog = await findDialog();

      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue(longTitle);
    });
  });
});
