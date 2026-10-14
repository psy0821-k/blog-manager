import { useCallback } from 'react';
import { useFetch } from '../../lib/use-fetch';
import { fetchCountedPosts } from './api/weekly-consistency-api';
import { aggregateWeeklyPostCounts } from './weekly-post-counts';

/** 이번 달 프로젝트/랩 발행 글을 조회해 주차별 편수로 집계한다. */
export function useWeeklyPostCounts() {
  const fetcher = useCallback(
    async (signal: AbortSignal) => aggregateWeeklyPostCounts(await fetchCountedPosts(signal), new Date()),
    [],
  );

  return useFetch(fetcher);
}
