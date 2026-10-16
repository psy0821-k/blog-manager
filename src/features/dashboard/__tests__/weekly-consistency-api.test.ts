import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import { fetchPostList } from '../../posts/posts-api';
import type { PostListItem, PostListResponse, PostType } from '../../posts/post-types';
import { COUNTED_POST_TYPES, fetchCountedPosts } from '../api/weekly-consistency-api';

vi.mock('../../posts/posts-api', () => ({ fetchPostList: vi.fn() }));

const mockedFetchPostList = vi.mocked(fetchPostList);

function makeItem(id: string): PostListItem {
  return {
    id,
    title: `글 ${id}`,
    slug: `post-${id}`,
    viewCount: 0,
    createdAt: '2026-10-02T03:00:00.000Z',
    updatedAt: '2026-10-02T03:00:00.000Z',
  };
}

function makeResponse(items: PostListItem[]): PostListResponse {
  return { data: items, meta: { page: 1, pageSize: 50, totalCount: items.length, totalPages: 1 } };
}

/** 종류별로 응답 또는 에러를 정해 fetchPostList를 흉내 낸다. */
function mockResponses(byType: Partial<Record<PostType, PostListItem[] | Error>>) {
  mockedFetchPostList.mockImplementation(async ({ type }) => {
    const result = byType[type];

    if (result instanceof Error) {
      throw result;
    }

    return makeResponse(result ?? []);
  });
}

describe('fetchCountedPosts', () => {
  const signal = new AbortController().signal;

  beforeEach(() => {
    mockedFetchPostList.mockReset();
  });

  it('집계 대상 종류는 프로젝트와 랩이어야 한다', () => {
    expect(COUNTED_POST_TYPES).toEqual(['PROJECT', 'LAB']);
  });

  it('프로젝트와 랩 두 경로를 각각 pageSize=50, 1페이지로 호출해야 한다', async () => {
    mockResponses({});

    await fetchCountedPosts(signal);

    expect(mockedFetchPostList).toHaveBeenCalledTimes(2);
    expect(mockedFetchPostList).toHaveBeenCalledWith(expect.objectContaining({ type: 'PROJECT', page: 1, pageSize: 50 }), signal);
    expect(mockedFetchPostList).toHaveBeenCalledWith(expect.objectContaining({ type: 'LAB', page: 1, pageSize: 50 }), signal);
  });

  it('두 응답의 글을 하나의 배열로 합쳐 반환해야 한다', async () => {
    mockResponses({ PROJECT: [makeItem('p1'), makeItem('p2')], LAB: [makeItem('l1')] });

    const posts = await fetchCountedPosts(signal);

    expect(posts.map(post => post.id)).toEqual(['p1', 'p2', 'l1']);
  });

  it('개발일지 경로는 호출하지 않아야 한다', async () => {
    mockResponses({});

    await fetchCountedPosts(signal);

    const requestedTypes = mockedFetchPostList.mock.calls.map(([params]) => params.type);
    expect(requestedTypes).not.toContain('DEV_LOG');
  });

  it('draft 파라미터를 보내지 않아 발행 글만 조회해야 한다', async () => {
    mockResponses({});

    await fetchCountedPosts(signal);

    for (const [params] of mockedFetchPostList.mock.calls) {
      expect(params.draft).toBeUndefined();
    }
  });

  it('한쪽 응답의 data가 비어 있어도 다른 쪽 글만으로 정상 반환해야 한다', async () => {
    mockResponses({ PROJECT: [], LAB: [makeItem('l1')] });

    const posts = await fetchCountedPosts(signal);

    expect(posts.map(post => post.id)).toEqual(['l1']);
  });

  it('프로젝트 조회가 실패하면 랩 결과를 쓰지 않고 ApiError로 reject해야 한다', async () => {
    mockResponses({ PROJECT: new ApiError(500, '요청에 실패했습니다. (500)'), LAB: [makeItem('l1')] });

    await expect(fetchCountedPosts(signal)).rejects.toBeInstanceOf(ApiError);
  });

  it('랩 조회가 실패하면 프로젝트 결과를 쓰지 않고 ApiError로 reject해야 한다', async () => {
    mockResponses({ PROJECT: [makeItem('p1')], LAB: new ApiError(500, '요청에 실패했습니다. (500)') });

    await expect(fetchCountedPosts(signal)).rejects.toBeInstanceOf(ApiError);
  });
});
