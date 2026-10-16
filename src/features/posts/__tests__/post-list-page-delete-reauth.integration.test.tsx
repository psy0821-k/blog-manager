import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isReloginLooping, redirectToBlogLogin } from '@/lib/auth-redirect';
import { PostListPage } from '../post-list-page';

vi.mock('@/lib/auth-redirect', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth-redirect')>()),
  redirectToBlogLogin: vi.fn(),
  isReloginLooping: vi.fn(() => false),
}));

const TOKEN_STORAGE_KEY = 'blog-manager-token';
const SLUG = 'hello world';
const TITLE = '삭제할 글';
const mockedRedirectToBlogLogin = vi.mocked(redirectToBlogLogin);
const mockedIsReloginLooping = vi.mocked(isReloginLooping);

/** payload에 exp(초)만 가진, 만료가 먼 JWT */
function createToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe('PostListPage 글 삭제 통합 (실제 apiDelete)', () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  let token: string;

  function listResponse() {
    const date = '2026-10-08T12:00:00Z';
    const item = { id: 'post-1', title: TITLE, slug: SLUG, viewCount: 0, createdAt: date, updatedAt: date };

    return new Response(
      JSON.stringify({ data: [item], meta: { page: 1, pageSize: 30, totalCount: 1, totalPages: 1 } }),
      { status: 200 }
    );
  }

  /** 목록 조회는 성공시키고 DELETE만 주어진 상태로 응답한다. 호출마다 새 Response를 만든다. */
  function deleteRespondsWith(status: number) {
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/api/categories')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (init?.method === 'DELETE') {
        return new Response(status === 204 ? null : '{}', { status });
      }

      return listResponse();
    });
  }

  function deleteCalls() {
    return fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
  }

  /** 행의 삭제 버튼과 대화상자의 삭제 버튼을 차례로 누른다. */
  async function renderAndConfirmDelete(entry: string) {
    const user = userEvent.setup();

    // apiDelete는 window.location으로 복귀 경로를 잡으므로 MemoryRouter와 같은 주소로 맞춘다
    window.history.replaceState(null, '', entry);
    render(
      <MemoryRouter initialEntries={[entry]}>
        <PostListPage />
      </MemoryRouter>
    );

    const row = (await screen.findByText(TITLE)).closest('tr');
    if (!row) throw new Error('행을 찾을 수 없다');

    await user.click(within(row).getByRole('button', { name: '삭제' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));
  }

  beforeEach(() => {
    token = createToken();
    sessionStorage.clear();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    mockedRedirectToBlogLogin.mockReset();
    mockedIsReloginLooping.mockReset();
    mockedIsReloginLooping.mockReturnValue(false);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('삭제하면 fetch가 DELETE, 인코딩된 slug 경로, 본문 없음, Bearer 토큰으로 호출되고 204 응답에서 대화상자가 닫혀야 한다', async () => {
    deleteRespondsWith(204);

    await renderAndConfirmDelete('/manage');

    await waitFor(() => expect(deleteCalls()).toHaveLength(1));
    const [url, init] = deleteCalls()[0];

    expect(String(url)).toMatch(new RegExp(`/api/projects/${encodeURIComponent(SLUG)}$`));
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toEqual({ Authorization: `Bearer ${token}` });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([401, 403])('DELETE가 %i이면 토큰을 지우고 현재 화면 경로로 재로그인을 한 번 시작하며 DELETE는 한 번만 전송돼야 한다', async status => {
    deleteRespondsWith(status);

    await renderAndConfirmDelete('/manage?draft=true');

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1));
    expect(mockedRedirectToBlogLogin).toHaveBeenCalledWith('/manage?draft=true');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    // 자동 재전송이 늦게 일어나는 경우를 놓치지 않도록 화면이 안정될 때까지 기다린다
    await screen.findByRole('alert');
    expect(deleteCalls()).toHaveLength(1);
  });

  it('DELETE가 403이어도 재로그인 루프 상태면 재로그인은 호출되지 않고 삭제하지 못했습니다. (403) 문구가 보이며 대화상자가 닫혀야 한다', async () => {
    mockedIsReloginLooping.mockReturnValue(true);
    deleteRespondsWith(403);

    await renderAndConfirmDelete('/manage');

    expect(await screen.findByRole('alert')).toHaveTextContent('삭제하지 못했습니다. (403)');
    expect(mockedRedirectToBlogLogin).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('DELETE가 500이면 토큰을 지우지 않고 재로그인도 호출하지 않아야 한다', async () => {
    deleteRespondsWith(500);

    await renderAndConfirmDelete('/manage');

    expect(await screen.findByRole('alert')).toHaveTextContent('삭제하지 못했습니다. (500)');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    expect(mockedRedirectToBlogLogin).not.toHaveBeenCalled();
  });

  it('DELETE가 네트워크 오류면 토큰을 지우지 않고 재로그인도 호출하지 않아야 한다', async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/api/categories')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (init?.method === 'DELETE') {
        throw new TypeError('network');
      }

      return listResponse();
    });

    await renderAndConfirmDelete('/manage');

    expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 오류로 삭제하지 못했습니다.');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    expect(mockedRedirectToBlogLogin).not.toHaveBeenCalled();
  });
});
