import {
  MOCK_IDEAS,
  MOCK_MONTH_LABEL,
  MOCK_RECENT_POSTS,
  MOCK_STALE_DRAFTS,
  MOCK_TODOS,
  MOCK_WEEKLY_POSTS,
  WEEKLY_POST_GOAL,
} from './dashboard-mock';
import { IdeaGeneratorCard } from './idea-generator-card';
import { IdeaProgressCard } from './idea-progress-card';
import { PostListCard } from './post-list-card';
import { QuickLinksCard } from './quick-links-card';
import { TodoSummaryCard } from './todo-summary-card';
import { WeeklyConsistencyCard } from './weekly-consistency-card';

export function DashboardPage() {
  return (
    <section className="space-y-6 p-4">
      <h1 className="text-xl font-semibold">대시보드</h1>

      <IdeaGeneratorCard />

      <div className="space-y-3">
        <h2 className="font-medium">나의 게시글 현황</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <WeeklyConsistencyCard monthLabel={MOCK_MONTH_LABEL} weeks={MOCK_WEEKLY_POSTS} goal={WEEKLY_POST_GOAL} />
          <PostListCard
            title="최근 게시글"
            description="최근 발행한 글"
            posts={MOCK_RECENT_POSTS}
            emptyText="아직 발행한 글이 없어요."
            moreHref="/manage"
          />
          <PostListCard
            title="임시 저장 게시물"
            description="수정한 지 오래된 순"
            posts={MOCK_STALE_DRAFTS}
            emptyText="방치된 임시저장 글이 없어요."
            moreHref="/manage"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickLinksCard />
        <IdeaProgressCard ideas={MOCK_IDEAS} />
        <TodoSummaryCard todos={MOCK_TODOS} />
      </div>
    </section>
  );
}
