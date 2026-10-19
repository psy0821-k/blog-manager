import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectToBlogLogin } from '@/lib/auth-redirect';
import { IdeaProgressSection } from '../idea-progress-section';

vi.mock('@/lib/auth-redirect', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth-redirect')>()),
  redirectToBlogLogin: vi.fn(),
  isReloginLooping: () => false,
}));

const TOKEN_STORAGE_KEY = 'blog-manager-token';
const mockedRedirectToBlogLogin = vi.mocked(redirectToBlogLogin);

// 대시보드가 mock으로 그리던 고정 제목. 실데이터로 바뀐 뒤에는 보이면 안 된다
const FORMER_MOCK_TITLE = 'Gemini 무료 티어로 글감 아이디어 제안 기능 붙이기';

const DOING = {
  id: 'idea-doing',
  title: '서버가 준 진행 글감',
  memo: '',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
};
const TODO = { ...DOING, id: 'idea-todo', title: '서버가 준 대기 글감', status: 'todo' };

/** payload에 exp(초)만 가진, 만료가 먼 JWT */
function createToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

function renderSection() {
  return render(
    <MemoryRouter>
      <IdeaProgressSection />
    </MemoryRouter>
  );
}

function ideaUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url)).filter(url => url.includes('/ideas'));
}

describe('IdeaProgressSection 통합', () => {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>();

  function respondWith(ideas: unknown[]) {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: ideas }), { status: 200 }));
  }

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, createToken());
    mockedRedirectToBlogLogin.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('정상', () => {
    it('서버가 진행 글감과 대기 글감을 주면 카드에 진행 글감 제목이 보이고 이전 mock의 고정 제목은 보이지 않아야 한다', async () => {
      respondWith([DOING, TODO]);

      renderSection();

      expect(await screen.findByText('서버가 준 진행 글감')).toBeInTheDocument();
      expect(screen.queryByText(FORMER_MOCK_TITLE)).not.toBeInTheDocument();
    });

    it('status 쿼리 없이 전체 조회로 한 번 요청해야 한다', async () => {
      respondWith([DOING]);

      renderSection();
      await screen.findByText('서버가 준 진행 글감');

      expect(ideaUrls(fetchMock)).toHaveLength(1);
      expect(ideaUrls(fetchMock)[0]).toMatch(/\/ideas$/);
    });
  });

  describe('경계', () => {
    it('진행 글감이 없으면 대기 글감 수가 보여야 한다', async () => {
      respondWith([TODO, { ...TODO, id: 'idea-todo-2' }]);

      renderSection();

      expect(await screen.findByText('대기중인 아이디어 2개')).toBeInTheDocument();
    });

    it('조회 중에는 로딩 표시가 보여야 한다', async () => {
      fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

      renderSection();

      expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
    });
  });

  describe('예외', () => {
    it('조회가 실패하면 카드에 오류와 "다시 시도"가 보이고, 누르면 다시 조회해 성공하면 목록이 보여야 한다', async () => {
      const user = userEvent.setup();
      // 기본 응답은 성공이고, 첫 요청만 500으로 실패시킨다
      respondWith([DOING]);
      fetchMock.mockImplementationOnce(async () => new Response('{}', { status: 500 }));

      renderSection();

      await user.click(await screen.findByRole('button', { name: '다시 시도' }));

      expect(await screen.findByText('서버가 준 진행 글감')).toBeInTheDocument();
      expect(ideaUrls(fetchMock)).toHaveLength(2);
    });

    it.each([401, 403])('조회가 %i이면 토큰을 지운 뒤 재로그인을 시작해야 한다', async status => {
      fetchMock.mockImplementation(async () => new Response('{}', { status }));

      renderSection();

      await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1));
      expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});
