import { useState } from 'react';
import type { DraftPost } from './api/draft-posts-api';
import { formatElapsedDays } from './elapsed-days';
import { PostListCard } from './post-list-card';
import { useDraftPosts } from './hooks/use-draft-posts';

function toSummary({ id, title, type, updatedAt }: DraftPost, now: Date) {
  return { id, title, type, meta: formatElapsedDays(updatedAt, now) };
}

/** 수정한 지 오래된 임시저장 글을 조회해 카드로 보여 준다. */
export function DraftPostsSection() {
  const { state, reload } = useDraftPosts();
  // 렌더마다 날짜가 바뀌지 않도록 마운트 시점의 날짜를 기준으로 쓴다
  const [now] = useState(() => new Date());

  return (
    <PostListCard
      title="임시 저장 게시물"
      description="수정한 지 오래된 순"
      status={state.status}
      onRetry={reload}
      posts={state.status === 'success' ? state.data.map(post => toSummary(post, now)) : []}
      emptyText="방치된 임시저장 글이 없어요."
      moreHref="/manage"
    />
  );
}
