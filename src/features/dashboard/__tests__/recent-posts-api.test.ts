import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostListItem, PostType } from '../../posts/post-types';
import { fetchPostList } from '../../posts/posts-api';
import { fetchRecentPosts } from '../api/recent-posts-api';

vi.mock('../../posts/posts-api', () => ({ fetchPostList: vi.fn() }));

const mockedFetchPostList = vi.mocked(fetchPostList);

function item(id: string, createdAt: string): PostListItem {
  return { id, title: `글 ${id}`, slug: id, viewCount: 0, createdAt, updatedAt: createdAt };
}

/** 서버처럼 pageSize만큼만 잘라 종류별 응답을 돌려준다. */
function respond(byType: Record<PostType, PostListItem[]>) {
  mockedFetchPostList.mockImplementation(async ({ type, pageSize = 30 }) => ({
    data: byType[type].slice(0, pageSize),
    meta: { page: 1, pageSize, totalCount: byType[type].length, totalPages: 1 },
  }));
}

describe('fetchRecentPosts', () => {
  beforeEach(() => {
    mockedFetchPostList.mockReset();
  });

  it('종류별 최신 1건씩을 프로젝트, 랩, 개발일지 순서로 돌려주고 종류를 붙인다', async () => {
    respond({
      PROJECT: [item('p1', '2026-09-01T00:00:00Z'), item('p2', '2026-08-01T00:00:00Z')],
      LAB: [item('l1', '2026-10-05T00:00:00Z')],
      DEV_LOG: [item('d1', '2026-10-09T00:00:00Z'), item('d2', '2026-08-01T00:00:00Z')],
    });

    const posts = await fetchRecentPosts(new AbortController().signal);

    expect(mockedFetchPostList).toHaveBeenCalledTimes(3);
    expect(mockedFetchPostList.mock.calls.every(([params]) => params.pageSize === 1)).toBe(true);
    expect(posts.map(({ id, type }) => [id, type])).toEqual([
      ['p1', 'PROJECT'],
      ['l1', 'LAB'],
      ['d1', 'DEV_LOG'],
    ]);
  });

  it('글이 없는 종류는 빠진다', async () => {
    respond({ PROJECT: [], LAB: [item('l1', '2026-10-05T00:00:00Z')], DEV_LOG: [] });

    const posts = await fetchRecentPosts(new AbortController().signal);

    expect(posts.map(({ type }) => type)).toEqual(['LAB']);
  });

  it('하나라도 실패하면 reject된다', async () => {
    mockedFetchPostList.mockRejectedValue(new Error('fail'));

    await expect(fetchRecentPosts(new AbortController().signal)).rejects.toThrow('fail');
  });
});
