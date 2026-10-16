import { Button } from '@/components/ui/button';
import { WeeklyConsistencyCardShell } from './weekly-consistency-card-shell';

interface WeeklyConsistencyErrorProps {
  monthLabel: string;
  onRetry: () => void;
}

/** 조회에 실패했을 때 그래프 대신 안내와 다시 시도 버튼을 보여 준다. 일부만 합산한 숫자는 실제보다 적어 보이므로 그리지 않는다. */
export function WeeklyConsistencyError({ monthLabel, onRetry }: WeeklyConsistencyErrorProps) {
  return (
    <WeeklyConsistencyCardShell description={monthLabel}>
      <div className="flex h-34 flex-col items-center justify-center gap-3">
        <p role="alert" className="text-sm text-muted-foreground">
          주차별 발행 현황을 불러오지 못했습니다.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    </WeeklyConsistencyCardShell>
  );
}
