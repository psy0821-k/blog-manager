import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { IDEA_STATUS_LABELS } from '../ideas/idea-types';
import type { IdeaSummary } from './dashboard-mock';

interface IdeaProgressCardProps {
  ideas: IdeaSummary[];
  status?: 'loading' | 'success' | 'error';
  onRetry?: () => void;
}

/** 진행(doing) 중인 아이디어 제목을 보여 주고, 없으면 대기 중인 아이디어 수를 보여 준다. */
export function IdeaProgressCard({ ideas, status = 'success', onRetry }: IdeaProgressCardProps) {
  const doingIdeas = ideas.filter(idea => idea.status === 'doing');
  const waitingCount = ideas.filter(idea => idea.status === 'todo').length;
  const [currentIdea, ...otherDoingIdeas] = doingIdeas;

  return (
    <Card>
      <CardHeader>
        <CardTitle>아이디어 진행</CardTitle>
        <CardDescription>{currentIdea ? '지금 쓰고 있는 글감' : '아이디어 페이지에서 진행을 선택해요'}</CardDescription>
        <CardAction>
          <Link to="/ideas" className="text-sm text-muted-foreground hover:underline">
            전체 보기
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <div role="status" aria-label="불러오는 중" className="flex justify-center py-6">
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <p role="alert" className="text-sm text-muted-foreground">
              글감을 불러오지 못했습니다.
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          </div>
        ) : currentIdea ? (
          <div className="space-y-2">
            <Badge>{IDEA_STATUS_LABELS.doing}</Badge>
            <p className="font-medium">{currentIdea.title}</p>
            {otherDoingIdeas.length > 0 && (
              <p className="text-xs text-muted-foreground">외 {otherDoingIdeas.length}개 진행 중</p>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">대기중인 아이디어 {waitingCount}개</p>
        )}
      </CardContent>
    </Card>
  );
}
