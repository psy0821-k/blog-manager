import { fetchPostList } from '../../posts/posts-api';
import { POST_TYPES } from '../../posts/post-types';
import type { PostType } from '../../posts/post-types';

export const DRAFT_POST_LIMIT = 3;

const DRAFT_PAGE_SIZE = 50;

export interface DraftPost {
  id: string;
  title: string;
  type: PostType;
  updatedAt: string;
}

export async function fetchDraftPosts(signal: AbortSignal): Promise<DraftPost[]> {
  const responses = await Promise.all(
    POST_TYPES.map(async type => {
      const { data } = await fetchPostList({ type, page: 1, pageSize: DRAFT_PAGE_SIZE, draft: true }, signal);
      return data.map(({ id, title, updatedAt }): DraftPost => ({ id, title, type, updatedAt }));
    })
  );

  return responses
    .flat()
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
    .slice(0, DRAFT_POST_LIMIT);
}
