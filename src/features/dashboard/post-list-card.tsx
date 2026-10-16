import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { POST_TYPE_LABELS } from '../posts/post-types';
import type { PostSummary } from './dashboard-mock';

interface PostListCardProps {
  title: string;
  description: string;
  posts: PostSummary[];
  emptyText: string;
  moreHref: string;
  status?: 'loading' | 'success' | 'error';
  onRetry?: () => void;
}

/** 최근 게시글, 임시 저장 게시물처럼 글을 한 줄씩 나열하는 카드. */
export function PostListCard({ title, description, posts, emptyText, moreHref, status = 'success', onRetry }: PostListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Link to={moreHref} className="text-sm text-muted-foreground hover:underline">
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
              글을 불러오지 못했습니다.
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {posts.map(post => (
              <li key={`${post.type}-${post.id}`} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline">{POST_TYPE_LABELS[post.type]}</Badge>
                  <span className="truncate text-sm">{post.title}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{post.meta}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
