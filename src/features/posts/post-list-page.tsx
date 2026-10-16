import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BLOG_LOGIN_URL } from '@/lib/env';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useCategories } from '../categories/use-categories';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import { Pagination } from './pagination';
import { getBlogOrigin } from './post-edit-url';
import { PostTable } from './post-table';
import type { PostListItem, PostType } from './post-types';
import { isPostType, POST_TYPE_LABELS, POST_TYPES } from './post-types';
import { usePostActions } from './use-post-actions';
import { usePostList } from './use-post-list';

/** 편집 링크의 블로그 오리진. 설정이 바뀌지 않으므로 모듈 로드 시 한 번만 구한다. */
const BLOG_ORIGIN = getBlogOrigin(BLOG_LOGIN_URL);
const DEFAULT_POST_TYPE = POST_TYPES[0];
const SEARCH_DEBOUNCE_MS = 300;
const ALL_CATEGORIES = 'all';
const DRAFT_PARAM = 'draft';
const DRAFT_PARAM_VALUE = 'true';

type PostView = 'published' | 'draft';

const POST_VIEW_LABELS: Record<PostView, string> = { published: '발행됨', draft: '임시저장' };
const EMPTY_MESSAGES: Record<PostView, string> = {
  published: '글이 없습니다.',
  draft: '임시저장 글이 없습니다.',
};
const TOGGLE_LABELS: Record<PostView, string> = { published: '임시저장으로 전환', draft: '발행' };
const POST_VIEWS = Object.keys(POST_VIEW_LABELS) as PostView[];

/** 삭제 대화상자를 연 시점의 글 종류와 대상 글. URL이 바뀌어도 처음 연 글을 가리킨다. */
interface DeleteTarget {
  type: PostType;
  post: PostListItem;
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function PostListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const typeParam = searchParams.get('type');
  const type = isPostType(typeParam) ? typeParam : DEFAULT_POST_TYPE;
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const page = parsePage(searchParams.get('page'));
  const view: PostView = searchParams.get(DRAFT_PARAM) === DRAFT_PARAM_VALUE ? 'draft' : 'published';

  const debouncedQ = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
  const { state: categoriesState } = useCategories(type);
  const { state, reload } = usePostList(type, page, debouncedQ, category, view === 'draft');
  const { isPending, errorMessage, togglePublished, remove } = usePostActions(reload);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function updateParams(updates: Record<string, string | undefined>) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);

        for (const [key, value] of Object.entries(updates)) {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        }

        return next;
      },
      { replace: true }
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    // 대상이 현재 목록에 있고 그 글이 현재 페이지의 유일한 항목이며 2쪽 이상일 때만 이전 페이지로 이동한다
    // (page 쿼리 변경이 재조회를 일으킨다). 대상이 현재 목록에 없으면 이동하지 않고 재조회만 한다.
    const isLastOnPage =
      page > 1 &&
      state.status === 'success' &&
      state.data.data.length === 1 &&
      state.data.data[0].id === deleteTarget.post.id;
    const handled = await remove(
      deleteTarget.type, // 현재 URL의 type이 아니라 대화상자를 연 시점의 type
      deleteTarget.post,
      isLastOnPage ? () => updateParams({ page: String(page - 1) }) : undefined
    );

    if (handled) setDeleteTarget(null);
  }

  const categories = categoriesState.status === 'success' ? categoriesState.data : [];

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">컨텐츠 관리</h1>

      <Tabs
        value={view}
        onValueChange={value => updateParams({ [DRAFT_PARAM]: value === 'draft' ? DRAFT_PARAM_VALUE : undefined, page: undefined })}
      >
        <TabsList>
          {POST_VIEWS.map(postView => (
            <TabsTrigger key={postView} value={postView}>
              {POST_VIEW_LABELS[postView]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs value={type} onValueChange={value => updateParams({ type: value, category: undefined, page: undefined })}>
        <TabsList>
          {POST_TYPES.map(postType => (
            <TabsTrigger key={postType} value={postType}>
              {POST_TYPE_LABELS[postType]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex gap-2">
        <Input placeholder="제목 검색" value={q} onChange={event => updateParams({ q: event.target.value, page: undefined })} />
        <Select
          value={category || ALL_CATEGORIES}
          onValueChange={value => updateParams({ category: value === ALL_CATEGORIES ? undefined : value, page: undefined })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>전체 카테고리</SelectItem>
            {categories.map(({ id, slug, name }) => (
              <SelectItem key={id} value={slug}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {state.status === 'loading' && <p className="text-sm">불러오는 중...</p>}

      {state.status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{state.error.message}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            다시 시도
          </Button>
        </div>
      )}

      {state.status === 'success' &&
        (state.data.data.length === 0 ? (
          <p className="text-sm">{EMPTY_MESSAGES[view]}</p>
        ) : (
          <>
            <PostTable
              posts={state.data.data}
              type={type}
              blogOrigin={BLOG_ORIGIN}
              rowToggle={{
                label: TOGGLE_LABELS[view],
                isPending,
                onToggle: post => void togglePublished(type, post, view === 'draft'),
              }}
              rowDelete={{ isPending, onDelete: post => setDeleteTarget({ type, post }) }}
            />
            <Pagination meta={state.data.meta} onPageChange={nextPage => updateParams({ page: String(nextPage) })} />
          </>
        ))}

      <ConfirmDeleteDialog
        title={deleteTarget?.post.title ?? null}
        isPending={deleteTarget !== null && isPending(deleteTarget.post.id)}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
