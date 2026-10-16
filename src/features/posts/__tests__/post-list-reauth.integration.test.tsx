import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectToBlogLogin } from '@/lib/auth-redirect';
import { PostListPage } from '../post-list-page';

vi.mock('@/lib/auth-redirect', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth-redirect')>()),
  redirectToBlogLogin: vi.fn(),
  isReloginLooping: () => false,
}));

const TOKEN_STORAGE_KEY = 'blog-manager-token';
const mockedRedirectToBlogLogin = vi.mocked(redirectToBlogLogin);

/** payload에 exp(초)만 가진, 만료가 먼 JWT */
function createToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe('PostListPage 401/403 재로그인 통합', () => {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>();

  function failListWith(status: number) {
    fetchMock.mockImplementation(async url =>
      String(url).includes('/api/categories')
        ? new Response(JSON.stringify([]), { status: 200 })
        : new Response('{}', { status })
    );
  }

  function listUrls(): string[] {
    return fetchMock.mock.calls.map(([url]) => String(url)).filter(url => url.includes('/api/projects'));
  }

  function renderAt(entry: string) {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <PostListPage />
      </MemoryRouter>
    );
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

  it.each([401, 403])('임시저장 요청이 %i이면 draft=true로 요청하고 토큰을 지운 뒤 재로그인을 시작해야 한다', async status => {
    failListWith(status);

    renderAt('/manage?draft=true');

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1));
    expect(listUrls().some(url => url.includes('draft=true'))).toBe(true);
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('발행됨 보기의 401은 draft 쿼리 없이 요청되고 같은 재로그인 흐름을 탄다', async () => {
    failListWith(401);

    renderAt('/manage');

    await waitFor(() => expect(mockedRedirectToBlogLogin).toHaveBeenCalledTimes(1));
    expect(listUrls().length).toBeGreaterThan(0);
    expect(listUrls().every(url => !url.includes('draft='))).toBe(true);
  });
});
