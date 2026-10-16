import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WeeklyConsistencyCardShellProps {
  description: string;
  children: ReactNode;
}

/** 제목과 설명은 고정하고 본문만 바꿔 끼우는 카드 틀. 그래프, 로딩, 에러가 함께 쓴다. */
export function WeeklyConsistencyCardShell({ description, children }: WeeklyConsistencyCardShellProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>주차별 성실도</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
