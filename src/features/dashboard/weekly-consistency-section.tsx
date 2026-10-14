import { useState } from 'react';
import { useWeeklyPostCounts } from './use-weekly-post-counts';
import { WeeklyConsistencyCard } from './weekly-consistency-card';
import { formatMonthLabel } from './weekly-post-counts';

/** 이번 달 주차별 발행 편수를 조회해 카드로 보여 준다. 로딩/에러 표시는 이후 이슈에서 추가한다. */
export function WeeklyConsistencySection() {
  const { state } = useWeeklyPostCounts();
  // 렌더마다 날짜가 바뀌지 않도록 마운트 시점의 날짜를 라벨에 쓴다
  const [now] = useState(() => new Date());

  if (state.status !== 'success') {
    return null;
  }

  return <WeeklyConsistencyCard monthLabel={formatMonthLabel(now)} weeks={state.data} />;
}
