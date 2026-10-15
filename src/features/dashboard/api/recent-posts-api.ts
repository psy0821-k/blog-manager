import { fetchPostList } from '../../posts/posts-api';
import { POST_TYPES } from '../../posts/post-types';
import type { PostType } from '../../posts/post-types';

export interface RecentPost {
  id: string;
  title: string;
  type: PostType;
  createdAt: string;
}

/** 종류(프로젝트, 랩, 개발일지)별 발행 글(draft 제외)의 최신 1건씩을 병렬 조회한다. 글이 없는 종류는 빠지고, 순서는 POST_TYPES를 따른다. 하나라도 실패하면 reject된다. */
export async function fetchRecentPosts(signal: AbortSignal): Promise<RecentPost[]> {
  const responses = await Promise.all(
    POST_TYPES.map(async type => {
      const { data } = await fetchPostList({ type, page: 1, pageSize: 1 }, signal);
      return data.map(({ id, title, createdAt }): RecentPost => ({ id, title, type, createdAt }));
    }),
  );

  return responses.flat();
}
