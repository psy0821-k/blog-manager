import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { POST_TYPE_LABELS } from '../posts/post-types';
import type { PostSummary } from './dashboard-mock';

interface PostListCardProps {
  title: string;
  description: string;
  posts: PostSummary[];
  emptyText: string;
  moreHref: string;
}

/** 최근 게시글, 임시 저장 게시물처럼 글을 한 줄씩 나열하는 카드. */
export function PostListCard({ title, description, posts, emptyText, moreHref }: PostListCardProps) {
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
        {posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {posts.map(post => (
              <li key={post.id} className="flex items-center justify-between gap-3 py-2">
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
