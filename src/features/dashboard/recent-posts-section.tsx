import { PostListCard } from './post-list-card';
import type { RecentPost } from './api/recent-posts-api';
import { useRecentPosts } from './hooks/use-recent-posts';

const monthDayFormatter = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' });

function formatMonthDay(isoDate: string): string {
  return monthDayFormatter
    .formatToParts(new Date(isoDate))
    .filter(({ type }) => type === 'month' || type === 'day')
    .map(({ value }) => value)
    .join('-');
}

function toSummary({ id, title, type, createdAt }: RecentPost) {
  return { id, title, type, meta: formatMonthDay(createdAt) };
}

export function RecentPostsSection() {
  const { state, reload } = useRecentPosts();

  return (
    <PostListCard
      title="최근 게시글"
      description="최근 발행한 글"
      status={state.status}
      onRetry={reload}
      posts={state.status === 'success' ? state.data.map(toSummary) : []}
      emptyText="아직 발행한 글이 없어요."
      moreHref="/manage"
    />
  );
}
