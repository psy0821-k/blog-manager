import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { IDEA_STATUS_LABELS } from '../ideas/idea-types';
import type { IdeaSummary } from './dashboard-mock';

interface IdeaProgressCardProps {
  ideas: IdeaSummary[];
}

/** 진행(doing) 중인 아이디어 제목을 보여 주고, 없으면 대기 중인 아이디어 수를 보여 준다. */
export function IdeaProgressCard({ ideas }: IdeaProgressCardProps) {
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
        {currentIdea ? (
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
