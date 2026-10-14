import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WeeklyPostCount } from './dashboard-mock';

interface WeeklyConsistencyCardProps {
  monthLabel: string;
  weeks: WeeklyPostCount[];
  /** 주간 목표 발행 편수 */
  goal: number;
}

/** 주차별 발행 수를 주간 목표 대비 막대로 보여 준다. 차트 라이브러리 없이 직접 그린다. */
export function WeeklyConsistencyCard({ monthLabel, weeks, goal }: WeeklyConsistencyCardProps) {
  const pastWeeks = weeks.filter(week => !week.isFuture);
  const achievedCount = pastWeeks.filter(week => week.count >= goal).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>주차별 성실도</CardTitle>
        <CardDescription>
          {monthLabel} · 주 {goal}편 목표 · 달성 {achievedCount}/{pastWeeks.length}주
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          {weeks.map(week => {
            const ratio = Math.min(week.count / goal, 1);
            return (
              <div key={week.week} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{week.isFuture ? '-' : `${week.count}/${goal}`}</span>
                <div className="flex h-24 w-full items-end rounded-t-md bg-muted/50">
                  <div
                    className={cn(
                      'w-full rounded-t-md',
                      week.isFuture ? 'bg-transparent' : week.count >= goal ? 'bg-primary' : 'bg-primary/40',
                    )}
                    style={{ height: `${ratio * 100}%` }}
                  />
                </div>
                <span className="text-xs">{week.week}주</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
