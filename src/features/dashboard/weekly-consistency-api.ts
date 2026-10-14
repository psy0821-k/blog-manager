import { fetchPostList } from '../posts/posts-api';
import type { PostListItem, PostType } from '../posts/post-types';

/** 집계 대상 종류. 개발일지(DEV_LOG)는 제외한다. */
export const COUNTED_POST_TYPES: readonly PostType[] = ['PROJECT', 'LAB'];

/** 서버가 허용하는 한 번의 최대 조회 개수 */
const COUNTED_PAGE_SIZE = 50;

/** 프로젝트/랩의 발행 글(draft 제외)을 1회씩 병렬 조회해 합친다. 하나라도 실패하면 reject된다. */
export async function fetchCountedPosts(signal: AbortSignal): Promise<PostListItem[]> {
  const responses = await Promise.all(
    COUNTED_POST_TYPES.map(type => fetchPostList({ type, page: 1, pageSize: COUNTED_PAGE_SIZE }, signal)),
  );

  return responses.flatMap(response => response.data);
}
