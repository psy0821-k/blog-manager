import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import { createIdea } from '../../ideas/ideas-api';
import type { SavedIdea } from '../../ideas/ideas-api';
import { generateIdeaReply, summarizeIdeaDraft } from '../api/idea-ai-api';
import { IdeaGeneratorCard } from '../idea-generator-card';

// AI 호출과 글감 저장 요청(HTTP 경계)만 대체하고 훅·다이얼로그·카드는 실제로 연결한다
vi.mock('../api/idea-ai-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/idea-ai-api')>()),
  generateIdeaReply: vi.fn(),
  summarizeIdeaDraft: vi.fn(),
}));
vi.mock('../../ideas/ideas-api', () => ({ createIdea: vi.fn() }));

const mockedReply = vi.mocked(generateIdeaReply);
const mockedSummarize = vi.mocked(summarizeIdeaDraft);
const mockedCreateIdea = vi.mocked(createIdea);

const DRAFT = { title: '요약 제목', memo: '- 요약 메모', type: 'LAB' } as const;

const SAVED: SavedIdea = {
  id: 'idea-1',
  title: '서버가 돌려준 제목',
  memo: '- 요약 메모',
  type: 'LAB',
  status: 'todo',
  createdAt: '2026-10-19T00:00:00.000Z',
};

/** 테스트가 끝나는 시점을 쥐는 지연된 요청 */
function createDeferred() {
  let resolve!: (idea: SavedIdea) => void;
  const promise = new Promise<SavedIdea>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

beforeEach(() => {
  mockedReply.mockReset();
  mockedReply.mockResolvedValue({ text: 'AI 답변입니다', suggestions: [] });
  mockedSummarize.mockReset();
  mockedSummarize.mockResolvedValue({ ...DRAFT });
  mockedCreateIdea.mockReset();
  mockedCreateIdea.mockResolvedValue(SAVED);
});

type User = ReturnType<typeof userEvent.setup>;

async function sendMessage(user: User, text: string) {
  await user.type(screen.getByPlaceholderText('메세지를 보내보세요'), text);
  await user.click(screen.getByRole('button', { name: /보내기/ }));
}

/** 메시지를 한 번 주고받은 뒤 "대화 저장"을 눌러 글감 초안 다이얼로그를 연다. */
async function openSaveDialog(user: User) {
  await sendMessage(user, '주제');
  await screen.findByText('AI 답변입니다');
  await waitFor(() => expect(screen.getByRole('button', { name: '대화 저장' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: '대화 저장' }));

  return screen.findByRole('dialog', { name: '대화 내용을 글감으로 저장' });
}

describe('IdeaGeneratorCard 대화 저장', () => {
  describe('정상', () => {
    it('대화한 뒤 "대화 저장"을 누르면 글감 초안 다이얼로그가 열려야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);

      const dialog = await openSaveDialog(user);

      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('요약 제목');
      expect(within(dialog).getByPlaceholderText('메모')).toHaveValue('- 요약 메모');
    });

    it('다이얼로그에서 저장하면 createIdea가 초안의 제목·메모·종류로 한 번 호출돼야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await user.click(within(dialog).getByRole('button', { name: '저장' }));

      await waitFor(() => expect(mockedCreateIdea).toHaveBeenCalledTimes(1));
      expect(mockedCreateIdea).toHaveBeenCalledWith({ title: '요약 제목', memo: '- 요약 메모', type: 'LAB' });
    });

    it('저장에 성공하면 다이얼로그가 닫히고 서버가 돌려준 제목으로 "…글감으로 저장했어요." 안내가 보여야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await user.click(within(dialog).getByRole('button', { name: '저장' }));

      expect(await screen.findByText(/서버가 돌려준 제목.*글감으로 저장했어요/)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('저장에 성공해도 대화 메시지는 그대로 남아 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await user.click(within(dialog).getByRole('button', { name: '저장' }));
      await screen.findByText(/글감으로 저장했어요/);

      expect(screen.getByText('주제')).toBeInTheDocument();
      expect(screen.getByText('AI 답변입니다')).toBeInTheDocument();
    });

    it('저장에 성공한 뒤 이어서 메시지를 보낼 수 있어야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      await user.click(within(dialog).getByRole('button', { name: '저장' }));
      await screen.findByText(/글감으로 저장했어요/);

      await sendMessage(user, '이어서 질문');

      await waitFor(() => expect(mockedReply).toHaveBeenCalledTimes(2));
      expect(await screen.findByText('이어서 질문')).toBeInTheDocument();
    });

    it('저장에 성공한 뒤 다시 "대화 저장"으로 저장하면 createIdea가 두 번째로 호출돼야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);
      const firstDialog = await openSaveDialog(user);
      await user.click(within(firstDialog).getByRole('button', { name: '저장' }));
      await screen.findByText(/글감으로 저장했어요/);

      await user.click(screen.getByRole('button', { name: '대화 저장' }));
      const secondDialog = await screen.findByRole('dialog', { name: '대화 내용을 글감으로 저장' });
      await user.click(within(secondDialog).getByRole('button', { name: '저장' }));

      await waitFor(() => expect(mockedCreateIdea).toHaveBeenCalledTimes(2));
    });
  });

  describe('경계', () => {
    it('저장 요청이 진행 중이면 저장 버튼이 비활성이고 한 번 더 눌러도 createIdea는 한 번만 호출돼야 한다', async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      mockedCreateIdea.mockReturnValue(deferred.promise);
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await user.click(within(dialog).getByRole('button', { name: '저장' }));
      const savingButton = await within(dialog).findByRole('button', { name: '저장 중…' });
      await user.click(savingButton);

      expect(savingButton).toBeDisabled();
      expect(mockedCreateIdea).toHaveBeenCalledTimes(1);

      deferred.resolve(SAVED);
      await screen.findByText(/글감으로 저장했어요/);
    });

    it('새 메시지를 보내면 이전 저장 안내가 사라져야 한다', async () => {
      const user = userEvent.setup();
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      await user.click(within(dialog).getByRole('button', { name: '저장' }));
      await screen.findByText(/글감으로 저장했어요/);

      await sendMessage(user, '다음 질문');

      await waitFor(() => expect(screen.queryByText(/글감으로 저장했어요/)).not.toBeInTheDocument());
    });

    it('대화가 비어 있으면 "대화 저장" 버튼이 비활성이어야 한다', () => {
      render(<IdeaGeneratorCard />);

      expect(screen.getByRole('button', { name: '대화 저장' })).toBeDisabled();
    });
  });

  describe('예외', () => {
    it('저장에 실패하면 다이얼로그가 열려 있고 입력한 제목·메모·종류가 그대로이며 저장 버튼이 다시 활성이어야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new Error('저장 실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      const titleInput = within(dialog).getByPlaceholderText('제목');
      await user.clear(titleInput);
      await user.type(titleInput, '고친 제목');
      await user.click(within(dialog).getByRole('button', { name: '개발일지' }));

      await user.click(within(dialog).getByRole('button', { name: '저장' }));

      await waitFor(() => expect(mockedCreateIdea).toHaveBeenCalledTimes(1));
      const stillOpen = await screen.findByRole('dialog', { name: '대화 내용을 글감으로 저장' });
      expect(within(stillOpen).getByPlaceholderText('제목')).toHaveValue('고친 제목');
      expect(within(stillOpen).getByPlaceholderText('메모')).toHaveValue('- 요약 메모');
      await waitFor(() => expect(within(stillOpen).getByRole('button', { name: '저장' })).toBeEnabled());

      await user.click(within(stillOpen).getByRole('button', { name: '저장' }));

      await waitFor(() => expect(mockedCreateIdea).toHaveBeenCalledTimes(2));
      expect(mockedCreateIdea).toHaveBeenLastCalledWith({ title: '고친 제목', memo: '- 요약 메모', type: 'DEV_LOG' });
    });

    it('저장에 실패하면 "글감으로 저장했어요" 안내가 보이지 않아야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new Error('저장 실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await user.click(within(dialog).getByRole('button', { name: '저장' }));

      await waitFor(() => expect(mockedCreateIdea).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/글감으로 저장했어요/)).not.toBeInTheDocument();
    });
  });
});

const INVALID_INPUT_MESSAGE = '입력한 내용을 저장할 수 없어요. 제목과 메모를 확인해 주세요.';
const AUTH_MESSAGE = '로그인이 만료됐거나 권한이 없어요. 다시 로그인해 주세요.';
const NETWORK_MESSAGE = '서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.';
const serverErrorMessage = (status: number) => `서버 오류로 저장하지 못했어요. 잠시 후 다시 시도해 주세요. (${status})`;

/** 다이얼로그에서 저장을 눌러 createIdea가 호출될 때까지 기다린다. */
async function clickSave(user: User, dialog: HTMLElement, expectedCalls: number) {
  await user.click(within(dialog).getByRole('button', { name: '저장' }));
  await waitFor(() => expect(mockedCreateIdea).toHaveBeenCalledTimes(expectedCalls));
}

describe('IdeaGeneratorCard 저장 실패 안내', () => {
  describe('예외', () => {
    it('서버가 500이면 다이얼로그가 열려 있고 안에 서버 오류 안내가 보이며 입력이 그대로이고 저장 버튼이 다시 활성이어야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new ApiError(500, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      const titleInput = within(dialog).getByPlaceholderText('제목');
      await user.clear(titleInput);
      await user.type(titleInput, '고친 제목');

      await clickSave(user, dialog, 1);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(serverErrorMessage(500));
      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('고친 제목');
      expect(within(dialog).getByPlaceholderText('메모')).toHaveValue('- 요약 메모');
      await waitFor(() => expect(within(dialog).getByRole('button', { name: '저장' })).toBeEnabled());
    });

    it('서버가 400이면 입력 내용을 확인하라는 안내가 보이고 입력이 그대로여야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new ApiError(400, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await clickSave(user, dialog, 1);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(INVALID_INPUT_MESSAGE);
      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('요약 제목');
    });

    it('네트워크 오류이면 연결을 확인하라는 안내가 보이고 입력이 그대로여야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new TypeError('Failed to fetch'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await clickSave(user, dialog, 1);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(NETWORK_MESSAGE);
      expect(within(dialog).getByPlaceholderText('제목')).toHaveValue('요약 제목');
    });

    it('서버가 403이면 로그인 안내가 보여야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new ApiError(403, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);

      await clickSave(user, dialog, 1);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(AUTH_MESSAGE);
    });
  });

  describe('정상', () => {
    it('오류 문구가 보이는 상태에서 내용을 고쳐 다시 저장해 성공하면 오류 문구가 사라지고 다이얼로그가 닫히며 저장 안내가 보여야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValueOnce(new ApiError(500, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      await clickSave(user, dialog, 1);
      await within(dialog).findByRole('alert');
      const titleInput = within(dialog).getByPlaceholderText('제목');
      await user.clear(titleInput);
      await user.type(titleInput, '고친 제목');

      await clickSave(user, dialog, 2);

      expect(await screen.findByText(/서버가 돌려준 제목.*글감으로 저장했어요/)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockedCreateIdea).toHaveBeenLastCalledWith({ title: '고친 제목', memo: '- 요약 메모', type: 'LAB' });
    });
  });

  describe('경계', () => {
    it('오류 문구가 보이는 상태에서 다시 저장하면 요청이 끝나기 전까지 이전 오류 문구가 보이지 않아야 한다', async () => {
      const user = userEvent.setup();
      const deferred = createDeferred();
      mockedCreateIdea.mockRejectedValueOnce(new ApiError(500, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      await clickSave(user, dialog, 1);
      await within(dialog).findByRole('alert');
      mockedCreateIdea.mockReturnValue(deferred.promise);

      await clickSave(user, dialog, 2);

      await within(dialog).findByRole('button', { name: '저장 중…' });
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();

      deferred.resolve(SAVED);
      await screen.findByText(/글감으로 저장했어요/);
    });

    it('저장이 실패한 뒤 취소로 닫고 다시 "대화 저장"으로 열면 오류 문구 없이 새 초안이 보여야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new ApiError(500, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      await clickSave(user, dialog, 1);
      await within(dialog).findByRole('alert');
      mockedSummarize.mockResolvedValue({ title: '새 초안 제목', memo: '- 새 메모', type: 'PROJECT' });

      await user.click(within(dialog).getByRole('button', { name: '취소' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: '대화 저장' }));

      const reopened = await screen.findByRole('dialog', { name: '대화 내용을 글감으로 저장' });
      expect(within(reopened).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(reopened).getByPlaceholderText('제목')).toHaveValue('새 초안 제목');
    });

    it('저장이 실패한 뒤 Esc로 닫고 다시 열어도 오류 문구 없이 새 초안이 보여야 한다', async () => {
      const user = userEvent.setup();
      mockedCreateIdea.mockRejectedValue(new ApiError(500, '실패'));
      render(<IdeaGeneratorCard />);
      const dialog = await openSaveDialog(user);
      await clickSave(user, dialog, 1);
      await within(dialog).findByRole('alert');
      mockedSummarize.mockResolvedValue({ title: '새 초안 제목', memo: '- 새 메모', type: 'PROJECT' });

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: '대화 저장' }));

      const reopened = await screen.findByRole('dialog', { name: '대화 내용을 글감으로 저장' });
      expect(within(reopened).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(reopened).getByPlaceholderText('제목')).toHaveValue('새 초안 제목');
    });
  });
});
