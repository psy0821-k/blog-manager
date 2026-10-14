import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyPostCount } from './weekly-post-counts';

interface WeeklyConsistencyCardProps {
  monthLabel: string;
  weeks: WeeklyPostCount[];
}

/** 주차별 발행 수를 그 달 최대 편수 대비 막대로 보여 준다. 차트 라이브러리 없이 직접 그린다. */
export function WeeklyConsistencyCard({ monthLabel, weeks }: WeeklyConsistencyCardProps) {
  const startedWeeks = weeks.filter(week => !week.isFuture);
  const totalCount = weeks.reduce((sum, week) => sum + week.count, 0);
  const activeWeekCount = startedWeeks.filter(week => week.count > 0).length;
  // 글이 없는 달에도 0으로 나누지 않도록 최소 1편을 기준으로 한다
  const maxCount = Math.max(1, ...weeks.map(week => week.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>주차별 성실도</CardTitle>
        <CardDescription>
          {monthLabel} · 총 {totalCount}편 · 글 올린 주 {activeWeekCount}/{startedWeeks.length}주
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          {weeks.map(week => (
            <div key={week.week} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{week.isFuture ? '-' : `${week.count}편`}</span>
              <div className="flex h-24 w-full items-end rounded-t-md bg-muted/50">
                <div
                  data-testid={`week-bar-${week.week}`}
                  className="w-full rounded-t-md bg-primary"
                  style={{ height: `${(week.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs">{week.week}주</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
