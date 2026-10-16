import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostListResponse } from '../post-types';
import { fetchPostList } from '../posts-api';
import { usePostList } from '../use-post-list';

vi.mock('../posts-api', () => ({ fetchPostList: vi.fn() }));

const mockedFetchPostList = vi.mocked(fetchPostList);

const EMPTY_RESPONSE: PostListResponse = {
  data: [],
  meta: { page: 1, pageSize: 30, totalCount: 0, totalPages: 0 },
};

describe('usePostList', () => {
  beforeEach(() => {
    mockedFetchPostList.mockReset();
    mockedFetchPostList.mockResolvedValue(EMPTY_RESPONSE);
  });

  it('draft가 false이면 fetchPostList를 draft: false로 호출해야 한다', async () => {
    renderHook(() => usePostList('PROJECT', 1, '', '', false));

    await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(1));
    expect(mockedFetchPostList.mock.calls[0][0]).toEqual({
      type: 'PROJECT',
      page: 1,
      q: '',
      category: '',
      draft: false,
    });
  });

  it('draft가 true이면 fetchPostList를 draft: true로 호출해야 한다', async () => {
    renderHook(() => usePostList('LAB', 2, 'react', 'web', true));

    await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(1));
    expect(mockedFetchPostList.mock.calls[0][0]).toEqual({
      type: 'LAB',
      page: 2,
      q: 'react',
      category: 'web',
      draft: true,
    });
  });

  it('draft만 바꿔 리렌더하면 이전 요청을 취소하고 다시 조회해야 한다', async () => {
    const { rerender } = renderHook(({ draft }) => usePostList('PROJECT', 1, '', '', draft), {
      initialProps: { draft: false },
    });
    await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(1));
    const firstSignal = mockedFetchPostList.mock.calls[0][1];

    rerender({ draft: true });

    await waitFor(() => expect(mockedFetchPostList).toHaveBeenCalledTimes(2));
    expect(mockedFetchPostList.mock.calls[1][0]).toMatchObject({ draft: true });
    expect(firstSignal.aborted).toBe(true);
  });
});
