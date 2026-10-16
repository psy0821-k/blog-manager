import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostListItem, PostType } from '../../posts/post-types';
import { fetchPostList } from '../../posts/posts-api';
import { fetchDraftPosts } from '../api/draft-posts-api';

vi.mock('../../posts/posts-api', () => ({ fetchPostList: vi.fn() }));

const mockedFetchPostList = vi.mocked(fetchPostList);

function item(id: string, updatedAt: string): PostListItem {
  return { id, title: `글 ${id}`, slug: id, viewCount: 0, createdAt: updatedAt, updatedAt };
}

/** 서버처럼 pageSize만큼만 잘라 종류별 응답을 돌려준다. */
function respond(byType: Record<PostType, PostListItem[]>) {
  mockedFetchPostList.mockImplementation(async ({ type, pageSize = 30 }) => ({
    data: byType[type].slice(0, pageSize),
    meta: { page: 1, pageSize, totalCount: byType[type].length, totalPages: 1 },
  }));
}

describe('fetchDraftPosts', () => {
  beforeEach(() => {
    mockedFetchPostList.mockReset();
  });

  it('세 종류를 draft로 한 번씩 최대 개수(50)로 조회한다', async () => {
    respond({ PROJECT: [], LAB: [], DEV_LOG: [] });

    await fetchDraftPosts(new AbortController().signal);

    expect(mockedFetchPostList).toHaveBeenCalledTimes(3);
    expect(mockedFetchPostList.mock.calls.map(([params]) => params)).toEqual([
      { type: 'PROJECT', page: 1, pageSize: 50, draft: true },
      { type: 'LAB', page: 1, pageSize: 50, draft: true },
      { type: 'DEV_LOG', page: 1, pageSize: 50, draft: true },
    ]);
  });

  it('종류를 섞어 수정한 지 오래된 순으로 3건만 돌려주고 종류를 붙인다', async () => {
    respond({
      PROJECT: [item('p1', '2026-09-01T00:00:00Z'), item('p2', '2026-05-01T00:00:00Z')],
      LAB: [item('l1', '2026-08-01T00:00:00Z'), item('l2', '2026-10-01T00:00:00Z')],
      DEV_LOG: [item('d1', '2026-03-01T00:00:00Z')],
    });

    const posts = await fetchDraftPosts(new AbortController().signal);

    expect(posts.map(({ id, type }) => [id, type])).toEqual([
      ['d1', 'DEV_LOG'],
      ['p2', 'PROJECT'],
      ['l1', 'LAB'],
    ]);
  });

  it('임시저장이 없으면 빈 배열을 돌려준다', async () => {
    respond({ PROJECT: [], LAB: [], DEV_LOG: [] });

    await expect(fetchDraftPosts(new AbortController().signal)).resolves.toEqual([]);
  });

  it('하나라도 실패하면 reject된다', async () => {
    mockedFetchPostList.mockRejectedValue(new Error('fail'));

    await expect(fetchDraftPosts(new AbortController().signal)).rejects.toThrow('fail');
  });
});
