import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import type { PostListItem } from '../../posts/post-types';
import { fetchCountedPosts } from '../api/weekly-consistency-api';
import { useWeeklyPostCounts } from '../hooks/use-weekly-post-counts';

vi.mock('../api/weekly-consistency-api', () => ({ fetchCountedPosts: vi.fn() }));

const mockedFetchCountedPosts = vi.mocked(fetchCountedPosts);

function makeItem(id: string, day: number): PostListItem {
  const createdAt = new Date(2026, 9, day, 12).toISOString();
  return { id, title: `글 ${id}`, slug: `post-${id}`, viewCount: 0, createdAt, updatedAt: createdAt };
}

describe('useWeeklyPostCounts', () => {
  beforeEach(() => {
    // 2026-10-14(2주차)로 고정하고 타이머는 건드리지 않는다
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 14, 12) });
    mockedFetchCountedPosts.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('마운트 직후 state가 loading이어야 한다', () => {
    mockedFetchCountedPosts.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWeeklyPostCounts());

    expect(result.current.state.status).toBe('loading');
  });

  it('조회가 성공하면 집계된 주차별 배열을 가진 success 상태가 되어야 한다', async () => {
    mockedFetchCountedPosts.mockResolvedValue([makeItem('a', 2), makeItem('b', 3), makeItem('c', 9)]);

    const { result } = renderHook(() => useWeeklyPostCounts());

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    const state = result.current.state;
    if (state.status !== 'success') {
      throw new Error('success 상태여야 한다');
    }
    expect(state.data.map(week => week.count)).toEqual([2, 1, 0, 0, 0]);
  });

  it('reload를 호출하면 다시 조회해 결과를 갱신해야 한다', async () => {
    mockedFetchCountedPosts.mockResolvedValueOnce([makeItem('a', 2)]);
    mockedFetchCountedPosts.mockResolvedValueOnce([makeItem('a', 2), makeItem('b', 4)]);

    const { result } = renderHook(() => useWeeklyPostCounts());
    await waitFor(() => expect(result.current.state.status).toBe('success'));

    act(() => result.current.reload());

    await waitFor(() => {
      const state = result.current.state;
      expect(state.status === 'success' && state.data[0].count).toBe(2);
    });
    expect(mockedFetchCountedPosts).toHaveBeenCalledTimes(2);
  });

  it('조회가 실패하면 error 상태가 되고 부분 집계 값은 노출되지 않아야 한다', async () => {
    mockedFetchCountedPosts.mockRejectedValue(new ApiError(500, '요청에 실패했습니다. (500)'));

    const { result } = renderHook(() => useWeeklyPostCounts());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).not.toHaveProperty('data');
  });
});
