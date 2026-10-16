import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import { fetchCategories } from '../../categories/categories-api';
import { PostListPage } from '../post-list-page';
import type { PostListItem, PostListResponse } from '../post-types';
import { fetchPostList } from '../posts-api';

vi.mock('../posts-api', () => ({ fetchPostList: vi.fn() }));
vi.mock('../../categories/categories-api', () => ({ fetchCategories: vi.fn() }));

const mockedFetchPostList = vi.mocked(fetchPostList);
const mockedFetchCategories = vi.mocked(fetchCategories);

const PUBLISHED_TITLE = '발행된 글 제목';
const DRAFT_TITLE = '임시저장 글 제목';
const TOTAL_PAGES = 5;

function makeItem(id: string, title: string): PostListItem {
  const date = '2026-10-08T12:00:00Z';
  return { id, title, slug: id, viewCount: 0, createdAt: date, updatedAt: date };
}

function makeResponse(data: PostListItem[], page = 1): PostListResponse {
  return { data, meta: { page, pageSize: 30, totalCount: data.length, totalPages: TOTAL_PAGES } };
}

/** 보기(draft)별로 다른 글을 돌려주고 요청한 page를 meta에 그대로 싣는다. */
function mockListByView() {
  mockedFetchPostList.mockImplementation(async ({ draft, page }) =>
    makeResponse(draft ? [makeItem('d1', DRAFT_TITLE)] : [makeItem('p1', PUBLISHED_TITLE)], page)
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = '/manage') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PostListPage />
      <LocationProbe />
    </MemoryRouter>
  );
}

function currentSearch() {
  return new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
}

function lastCallParams() {
  return mockedFetchPostList.mock.calls[mockedFetchPostList.mock.calls.length - 1][0];
}

describe('PostListPage 보기 전환', () => {
  beforeEach(() => {
    mockedFetchPostList.mockReset();
    mockedFetchCategories.mockReset();
    mockedFetchCategories.mockResolvedValue([]);
    mockListByView();
  });

  describe('정상', () => {
    it('주소에 draft가 없으면 발행됨 탭이 선택되고 발행된 글이 draft: false로 조회되어야 한다', async () => {
      renderPage();

      expect(await screen.findByText(PUBLISHED_TITLE)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '발행됨' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: '임시저장' })).toHaveAttribute('aria-selected', 'false');
      expect(lastCallParams().draft).toBeFalsy();
    });

    it('임시저장 탭을 누르면 draft: true로 조회하고 임시저장 글만 보이며 주소에 draft=true가 붙어야 한다', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText(PUBLISHED_TITLE);

      await user.click(screen.getByRole('tab', { name: '임시저장' }));

      expect(await screen.findByText(DRAFT_TITLE)).toBeInTheDocument();
      expect(screen.queryByText(PUBLISHED_TITLE)).not.toBeInTheDocument();
      expect(lastCallParams().draft).toBe(true);
      expect(currentSearch().get('draft')).toBe('true');
      expect(screen.getByRole('tab', { name: '임시저장' })).toHaveAttribute('aria-selected', 'true');
    });

    it('초기 주소가 ?draft=true이면 임시저장 탭이 선택되고 처음부터 draft: true로만 조회해야 한다', async () => {
      renderPage('/manage?draft=true');

      expect(await screen.findByText(DRAFT_TITLE)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '임시저장' })).toHaveAttribute('aria-selected', 'true');
      expect(mockedFetchPostList.mock.calls.length).toBeGreaterThan(0);
      for (const [params] of mockedFetchPostList.mock.calls) {
        expect(params.draft).toBe(true);
      }
    });

    it('임시저장에서 발행됨 탭을 누르면 draft가 주소에서 사라지고 draft: false로 조회해야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?draft=true');
      await screen.findByText(DRAFT_TITLE);

      await user.click(screen.getByRole('tab', { name: '발행됨' }));

      expect(await screen.findByText(PUBLISHED_TITLE)).toBeInTheDocument();
      expect(currentSearch().has('draft')).toBe(false);
      expect(lastCallParams().draft).toBeFalsy();
    });

    it('임시저장 보기에서 종류 탭을 바꾸면 보기가 유지되고 새 종류로 draft: true 조회가 나가야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?draft=true');
      await screen.findByText(DRAFT_TITLE);

      await user.click(screen.getByRole('tab', { name: '랩' }));

      await waitFor(() => expect(lastCallParams()).toMatchObject({ type: 'LAB', draft: true }));
      expect(currentSearch().get('draft')).toBe('true');
      expect(currentSearch().get('type')).toBe('LAB');
      expect(screen.getByRole('tab', { name: '임시저장' })).toHaveAttribute('aria-selected', 'true');
    });

    it('발행됨 보기에서 글이 0건이면 "글이 없습니다."가 보여야 한다', async () => {
      mockedFetchPostList.mockResolvedValue(makeResponse([]));
      renderPage();

      expect(await screen.findByText('글이 없습니다.')).toBeInTheDocument();
    });

    it('임시저장 보기에서 글이 0건이면 "임시저장 글이 없습니다."만 보여야 한다', async () => {
      mockedFetchPostList.mockResolvedValue(makeResponse([]));
      renderPage('/manage?draft=true');

      expect(await screen.findByText('임시저장 글이 없습니다.')).toBeInTheDocument();
      expect(screen.queryByText('글이 없습니다.')).not.toBeInTheDocument();
    });
  });

  describe('경계', () => {
    it('?draft=true&page=3에서 발행됨을 누르면 page가 사라져 1쪽을 조회하고 type, q, category는 유지해야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?type=LAB&q=react&category=web&draft=true&page=3');
      await screen.findByText(DRAFT_TITLE);

      await user.click(screen.getByRole('tab', { name: '발행됨' }));

      await waitFor(() =>
        expect(lastCallParams()).toMatchObject({ type: 'LAB', q: 'react', category: 'web', page: 1 })
      );
      expect(lastCallParams().draft).toBeFalsy();
      const search = currentSearch();
      expect(search.has('page')).toBe(false);
      expect(search.has('draft')).toBe(false);
      expect(search.get('type')).toBe('LAB');
      expect(search.get('q')).toBe('react');
      expect(search.get('category')).toBe('web');
    });

    it('발행됨 2쪽에서 임시저장을 누르면 page가 사라지고 draft=true만 붙어 1쪽을 조회해야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?page=2');
      await screen.findByText(PUBLISHED_TITLE);

      await user.click(screen.getByRole('tab', { name: '임시저장' }));

      await waitFor(() => expect(lastCallParams()).toMatchObject({ draft: true, page: 1 }));
      expect(currentSearch().has('page')).toBe(false);
      expect(currentSearch().get('draft')).toBe('true');
    });

    it('임시저장 3쪽에서 종류 탭을 바꾸면 page가 사라지고 draft는 유지되어야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?draft=true&page=3');
      await screen.findByText(DRAFT_TITLE);

      await user.click(screen.getByRole('tab', { name: '개발일지' }));

      await waitFor(() => expect(lastCallParams()).toMatchObject({ type: 'DEV_LOG', draft: true, page: 1 }));
      expect(currentSearch().has('page')).toBe(false);
      expect(currentSearch().get('draft')).toBe('true');
    });

    it('임시저장 3쪽에서 검색어를 바꾸면 draft=true가 유지되고 page가 사라져 1쪽을 조회해야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?draft=true&page=3');
      await screen.findByText(DRAFT_TITLE);

      await user.type(screen.getByPlaceholderText('제목 검색'), 'abc');

      await waitFor(() => expect(lastCallParams()).toMatchObject({ q: 'abc', draft: true, page: 1 }));
      expect(currentSearch().get('draft')).toBe('true');
      expect(currentSearch().has('page')).toBe(false);
    });

    it('임시저장 보기에서 다음을 누르면 draft=true와 page=2가 함께 유지되어야 한다', async () => {
      const user = userEvent.setup();
      renderPage('/manage?draft=true');
      await screen.findByText(DRAFT_TITLE);

      await user.click(screen.getByRole('button', { name: '다음' }));

      await waitFor(() => expect(lastCallParams()).toMatchObject({ draft: true, page: 2 }));
      expect(currentSearch().get('draft')).toBe('true');
      expect(currentSearch().get('page')).toBe('2');
    });

    it.each(['false', '1', ''])('?draft=%s처럼 true가 아닌 값은 발행됨 보기로 draft: false 조회해야 한다', async value => {
      renderPage(`/manage?draft=${value}`);

      expect(await screen.findByText(PUBLISHED_TITLE)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '발행됨' })).toHaveAttribute('aria-selected', 'true');
      for (const [params] of mockedFetchPostList.mock.calls) {
        expect(params.draft).toBeFalsy();
      }
    });

    it('보기 전환 직후 새 조회가 끝나기 전에는 이전 보기의 글 대신 불러오는 중이 보여야 한다', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText(PUBLISHED_TITLE);
      mockedFetchPostList.mockReturnValue(new Promise(() => {}));

      await user.click(screen.getByRole('tab', { name: '임시저장' }));

      expect(await screen.findByText('불러오는 중...')).toBeInTheDocument();
      expect(screen.queryByText(PUBLISHED_TITLE)).not.toBeInTheDocument();
    });
  });

  describe('예외', () => {
    it('임시저장 조회가 실패하면 에러와 다시 시도가 보이고 같은 draft: true 조건으로 재조회해야 한다', async () => {
      const user = userEvent.setup();
      mockedFetchPostList.mockRejectedValue(new ApiError(500, '요청에 실패했습니다. (500)'));
      renderPage('/manage?draft=true');

      expect(await screen.findByText('요청에 실패했습니다. (500)')).toBeInTheDocument();
      const callsBefore = mockedFetchPostList.mock.calls.length;
      expect(lastCallParams().draft).toBe(true);

      mockedFetchPostList.mockResolvedValue(makeResponse([makeItem('d1', DRAFT_TITLE)]));
      await user.click(screen.getByRole('button', { name: '다시 시도' }));

      expect(await screen.findByText(DRAFT_TITLE)).toBeInTheDocument();
      expect(mockedFetchPostList.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(lastCallParams()).toMatchObject({ draft: true });
    });

    it('카테고리 조회가 실패해도 보기 전환과 목록 조회는 동작해야 한다', async () => {
      const user = userEvent.setup();
      mockedFetchCategories.mockRejectedValue(new ApiError(500, '카테고리 실패'));
      renderPage();
      await screen.findByText(PUBLISHED_TITLE);

      await user.click(screen.getByRole('tab', { name: '임시저장' }));

      expect(await screen.findByText(DRAFT_TITLE)).toBeInTheDocument();
    });
  });
});
