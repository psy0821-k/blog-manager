import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { IdeaSummary } from '../dashboard-mock';
import { IdeaProgressCard } from '../idea-progress-card';

const DOING_FIRST: IdeaSummary = { id: 'idea-1', title: '먼저 진행하는 글감', status: 'doing' };
const DOING_SECOND: IdeaSummary = { id: 'idea-2', title: '두 번째 진행 글감', status: 'doing' };
const TODO_A: IdeaSummary = { id: 'idea-3', title: '대기 글감 A', status: 'todo' };
const TODO_B: IdeaSummary = { id: 'idea-4', title: '대기 글감 B', status: 'todo' };
const DONE: IdeaSummary = { id: 'idea-5', title: '끝낸 글감', status: 'done' };

function renderCard(props: Partial<React.ComponentProps<typeof IdeaProgressCard>> = {}) {
  return render(
    <MemoryRouter>
      <IdeaProgressCard ideas={[]} {...props} />
    </MemoryRouter>
  );
}

describe('IdeaProgressCard', () => {
  describe('정상', () => {
    it('status를 생략하면 진행 글감 제목과 "외 N개 진행 중"을 보여야 한다', () => {
      renderCard({ ideas: [DOING_FIRST, DOING_SECOND, TODO_A, DONE] });

      expect(screen.getByText('먼저 진행하는 글감')).toBeInTheDocument();
      expect(screen.getByText('외 1개 진행 중')).toBeInTheDocument();
      expect(screen.queryByText('두 번째 진행 글감')).not.toBeInTheDocument();
    });

    it('진행 글감이 없으면 "대기중인 아이디어 N개"를 보여야 한다', () => {
      renderCard({ ideas: [TODO_A, TODO_B, DONE] });

      expect(screen.getByText('대기중인 아이디어 2개')).toBeInTheDocument();
    });
  });

  describe('경계', () => {
    it('글감이 하나도 없으면 "대기중인 아이디어 0개"를 보여야 한다', () => {
      renderCard({ ideas: [] });

      expect(screen.getByText('대기중인 아이디어 0개')).toBeInTheDocument();
    });

    it('status가 loading이면 role="status" 로딩 표시가 보이고 목록 내용은 보이지 않아야 한다', () => {
      renderCard({ ideas: [DOING_FIRST], status: 'loading' });

      expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
      expect(screen.queryByText('먼저 진행하는 글감')).not.toBeInTheDocument();
      expect(screen.queryByText(/대기중인 아이디어/)).not.toBeInTheDocument();
    });
  });

  describe('예외', () => {
    it('status가 error이면 role="alert" 오류 문구와 "다시 시도" 버튼이 보이고, 누르면 onRetry가 호출돼야 한다', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      renderCard({ ideas: [DOING_FIRST], status: 'error', onRetry });

      expect(screen.getByRole('alert')).toHaveTextContent('글감을 불러오지 못했습니다.');
      expect(screen.queryByText('먼저 진행하는 글감')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '다시 시도' }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
