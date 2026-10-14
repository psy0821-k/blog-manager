import { useState } from 'react';
import { useWeeklyPostCounts } from './use-weekly-post-counts';
import { WeeklyConsistencyCard } from './weekly-consistency-card';
import { WeeklyConsistencyError } from './weekly-consistency-error';
import { WeeklyConsistencyLoading } from './weekly-consistency-loading';
import { formatMonthLabel } from './weekly-post-counts';

/** 이번 달 주차별 발행 편수를 조회해, 상태에 맞는 화면(스피너, 에러, 그래프)을 고른다. */
export function WeeklyConsistencySection() {
  const { state, reload } = useWeeklyPostCounts();
  // 렌더마다 날짜가 바뀌지 않도록 마운트 시점의 날짜를 라벨에 쓴다
  const [now] = useState(() => new Date());
  const monthLabel = formatMonthLabel(now);

  if (state.status === 'loading') {
    return <WeeklyConsistencyLoading monthLabel={monthLabel} />;
  }

  if (state.status === 'error') {
    return <WeeklyConsistencyError monthLabel={monthLabel} onRetry={reload} />;
  }

  return <WeeklyConsistencyCard monthLabel={monthLabel} weeks={state.data} />;
}
