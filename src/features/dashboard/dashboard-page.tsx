import { MOCK_IDEAS, MOCK_STALE_DRAFTS, MOCK_TODOS } from './dashboard-mock';
import { IdeaGeneratorCard } from './idea-generator-card';
import { IdeaProgressCard } from './idea-progress-card';
import { PostListCard } from './post-list-card';
import { QuickLinksCard } from './quick-links-card';
import { RecentPostsSection } from './recent-posts-section';
import { TodoSummaryCard } from './todo-summary-card';
import { WeeklyConsistencySection } from './weekly-consistency-section';

export function DashboardPage() {
  return (
    <section className="space-y-6 p-4">
      <h1 className="text-xl font-semibold">대시보드</h1>

      <IdeaGeneratorCard />

      <div className="space-y-3">
        <h2 className="font-medium">나의 게시글 현황</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <WeeklyConsistencySection />
          <RecentPostsSection />
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
