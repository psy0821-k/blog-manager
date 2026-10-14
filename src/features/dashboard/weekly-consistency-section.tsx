import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWeeklyPostCounts } from './use-weekly-post-counts';
import { WeeklyConsistencyCard, WeeklyConsistencyCardShell } from './weekly-consistency-card';
import { formatMonthLabel } from './weekly-post-counts';

/** 이번 달 주차별 발행 편수를 조회해 카드로 보여 준다. 조회 중에는 스피너, 실패하면 에러와 다시 시도 버튼을 보여 준다. */
export function WeeklyConsistencySection() {
  const { state, reload } = useWeeklyPostCounts();
  // 렌더마다 날짜가 바뀌지 않도록 마운트 시점의 날짜를 라벨에 쓴다
  const [now] = useState(() => new Date());
  const monthLabel = formatMonthLabel(now);

  if (state.status === 'loading') {
    return (
      <WeeklyConsistencyCardShell description={monthLabel}>
        {/* 막대 그래프와 같은 높이를 잡아 로딩이 끝나도 카드 크기가 바뀌지 않게 한다 */}
        <div role="status" aria-label="불러오는 중" className="flex h-34 items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
        </div>
      </WeeklyConsistencyCardShell>
    );
  }

  if (state.status === 'error') {
    // 일부만 합산한 숫자는 실제보다 적게 보이므로 그래프 대신 안내만 보여 준다
    return (
      <WeeklyConsistencyCardShell description={monthLabel}>
        <div className="flex h-34 flex-col items-center justify-center gap-3">
          <p role="alert" className="text-sm text-muted-foreground">
            주차별 발행 현황을 불러오지 못했습니다.
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            다시 시도
          </Button>
        </div>
      </WeeklyConsistencyCardShell>
    );
  }

  return <WeeklyConsistencyCard monthLabel={monthLabel} weeks={state.data} />;
}
