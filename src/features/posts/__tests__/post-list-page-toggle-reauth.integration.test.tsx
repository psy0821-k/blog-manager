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
const TITLE = '전환할 글';
const mockedRedirectToBlogLogin = vi.mocked(redirectToBlogLogin);
const mockedIsReloginLooping = vi.mocked(isReloginLooping);

/** payload에 exp(초)만 가진, 만료가 먼 JWT */
function createToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe('PostListPage 발행 전환 통합 (실제 apiPatch)', () => {
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

  /** 목록 조회는 성공시키고 PATCH만 주어진 상태로 응답한다. */
  function patchRespondsWith(status: number) {
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes('/api/categories')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (init?.method === 'PATCH') {
        return new Response(status === 204 ? null : '{}', { status });
      }

      return listResponse();
    });
  }

  function patchCalls() {
    return fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
  }

  async function renderAndClick(entry: string, buttonName: string) {
    const user = userEvent.setup();

    // apiPatch는 window.location으로 복귀 경로를 잡으므로 MemoryRouter와 같은 주소로 맞춘다
    window.history.replaceState(null, '', entry);
    render(
      <MemoryRouter initialEntries={[entry]}>
        <PostListPage />
      </MemoryRouter>
    );

    const row = (await screen.findByText(TITLE)).closest('tr');
    if (!row) throw new Error('행을 찾을 수 없다');

    await user.click(within(row).getByRole('button', { name: buttonName }));
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

  it('전환하면 fetch가 PATCH, 인코딩된 slug 경로, { published: true } 본문, Bearer 토큰으로 호출돼야 한다', async () => {
    patchRespondsWith(200);

    await renderAndClick('/manage?draft=true', '발행');

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    const [url, init] = patchCalls()[0];

    expect(String(url)).toMatch(new RegExp(`/api/projects/${encodeURIComponent(SLUG)}$`));
    expect(init?.body).toBe('{"published":true}');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  });

  it.each([401, 403])('PATCH가 %i이면 토큰을 지우고 현재 화면 경로로 재로그인을 한 번 시작해야 한다', async status => {
    patchRespondsWith(status);

    await renderAndClick('/manage?draft=true', '발행');

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1));
    expect(mockedRedirectToBlogLogin).toHaveBeenCalledWith('/manage?draft=true');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('PATCH가 403이어도 재로그인 루프 상태면 재로그인은 호출되지 않고 상태를 바꾸지 못했습니다 (403) 문구가 보여야 한다', async () => {
    mockedIsReloginLooping.mockReturnValue(true);
    patchRespondsWith(403);

    await renderAndClick('/manage', '임시저장으로 전환');

    expect(await screen.findByRole('alert')).toHaveTextContent('상태를 바꾸지 못했습니다. (403)');
    expect(mockedRedirectToBlogLogin).not.toHaveBeenCalled();
  });
});
