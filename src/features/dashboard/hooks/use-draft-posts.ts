import { fetchDraftPosts } from '../api/draft-posts-api';
import { useFetch } from '../../../lib/use-fetch';

export function useDraftPosts() {
  return useFetch(fetchDraftPosts);
}
