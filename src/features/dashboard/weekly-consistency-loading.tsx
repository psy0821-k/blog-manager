import { LoaderCircle } from 'lucide-react';
import { WeeklyConsistencyCardShell } from './weekly-consistency-card-shell';

interface WeeklyConsistencyLoadingProps {
  monthLabel: string;
}

/** 조회 중에 그래프 자리에 스피너를 보여 준다. */
export function WeeklyConsistencyLoading({ monthLabel }: WeeklyConsistencyLoadingProps) {
  return (
    <WeeklyConsistencyCardShell description={monthLabel}>
      {/* 막대 그래프와 같은 높이를 잡아 로딩이 끝나도 카드 크기가 바뀌지 않게 한다 */}
      <div role="status" aria-label="불러오는 중" className="flex h-34 items-center justify-center">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
      </div>
    </WeeklyConsistencyCardShell>
  );
}
