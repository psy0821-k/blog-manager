import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TodoSummaryItem } from './dashboard-mock';

interface TodoSummaryCardProps {
  todos: TodoSummaryItem[];
}

/** 오늘 할 일의 완료율과 항목을 요약한다. */
export function TodoSummaryCard({ todos }: TodoSummaryCardProps) {
  const doneCount = todos.filter(todo => todo.done).length;
  const percent = todos.length === 0 ? 0 : Math.round((doneCount / todos.length) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>오늘 할 일</CardTitle>
        <CardDescription>
          {percent}% 완료 · {todos.length - doneCount}개 남음
        </CardDescription>
        <CardAction>
          <Link to="/todo" className="text-sm text-muted-foreground hover:underline">
            전체 보기
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <ul className="space-y-2">
          {todos.map(todo => (
            <li key={todo.id} className="flex items-center gap-3 rounded-lg border p-2">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  todo.done && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {todo.done && <Check className="size-3" />}
              </span>
              <span className={cn('min-w-0 flex-1 truncate text-sm', todo.done && 'text-muted-foreground line-through')}>
                {todo.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{todo.dueLabel}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
