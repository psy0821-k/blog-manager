import { fetchRecentPosts } from './api/recent-posts-api';
import { useFetch } from '../../lib/use-fetch';

/** 프로젝트/랩/개발일지 중 가장 최근에 발행한 글을 조회한다. */
export function useRecentPosts() {
  return useFetch(fetchRecentPosts);
}
