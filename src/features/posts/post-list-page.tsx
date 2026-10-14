import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useCategories } from '../categories/use-categories';
import { Pagination } from './pagination';
import { PostTable } from './post-table';
import { isPostType, POST_TYPE_LABELS, POST_TYPES } from './post-types';
import { usePostList } from './use-post-list';

const DEFAULT_POST_TYPE = POST_TYPES[0];
const SEARCH_DEBOUNCE_MS = 300;
const ALL_CATEGORIES = 'all';

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

  const debouncedQ = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
  const { state: categoriesState } = useCategories(type);
  const { state, reload } = usePostList(type, page, debouncedQ, category);

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

  const categories = categoriesState.status === 'success' ? categoriesState.data : [];

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">컨텐츠 관리</h1>

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
          <p className="text-sm">글이 없습니다.</p>
        ) : (
          <>
            <PostTable posts={state.data.data} />
            <Pagination meta={state.data.meta} onPageChange={nextPage => updateParams({ page: String(nextPage) })} />
          </>
        ))}
    </section>
  );
}
