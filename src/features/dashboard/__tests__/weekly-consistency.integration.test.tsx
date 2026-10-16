import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import type { PostListItem, PostListResponse, PostType } from '../../posts/post-types';
import { fetchPostList } from '../../posts/posts-api';
import { WeeklyConsistencySection } from '../weekly-consistency-section';

// HTTP 경계(fetchPostList)만 가짜로 두고 조회 함수, 훅, 집계, 섹션, 카드는 실제로 연결해 검증한다
vi.mock('../../posts/posts-api', () => ({ fetchPostList: vi.fn() }));

const mockedFetchPostList = vi.mocked(fetchPostList);

type PostsByType = Partial<Record<PostType, Date[]>>;

function makeItem(id: string, createdAt: Date): PostListItem {
  const iso = createdAt.toISOString();
  return { id, title: `글 ${id}`, slug: `post-${id}`, viewCount: 0, createdAt: iso, updatedAt: iso };
}

function makeResponse(items: PostListItem[]): PostListResponse {
  return { data: items, meta: { page: 1, pageSize: 50, totalCount: items.length, totalPages: 1 } };
}

/** 종류별 createdAt 목록으로 fetchPostList를 흉내 낸다. 값이 Error이면 그 종류만 실패한다. */
function mockPosts(byType: PostsByType, failingTypes: PostType[] = []) {
  mockedFetchPostList.mockImplementation(async ({ type }) => {
    if (failingTypes.includes(type)) {
      throw new ApiError(500, '요청에 실패했습니다. (500)');
    }

    const dates = byType[type] ?? [];
    return makeResponse(dates.map((date, index) => makeItem(`${type}-${index}`, date)));
  });
}

/** 해당 주차 막대의 높이(%) */
function barHeightOf(week: number): number {
  return parseFloat(screen.getByTestId(`week-bar-${week}`).style.height);
}

function setToday(year: number, month: number, day: number) {
  vi.setSystemTime(new Date(year, month - 1, day, 12));
}

describe('주차별 성실도 통합 (조회 → 집계 → 카드)', () => {
  beforeEach(() => {
    // Date만 가짜로 만들어 실제 Promise와 userEvent는 그대로 쓴다
    vi.useFakeTimers({ toFake: ['Date'] });
    mockedFetchPostList.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('집계 대상 (이슈 1)', () => {
    it('1~7일에 프로젝트 1편, 랩 1편을 발행하면 1주차에 "2편"이 표시되어야 한다', async () => {
      setToday(2026, 10, 14);
      mockPosts({ PROJECT: [new Date(2026, 9, 2, 10)], LAB: [new Date(2026, 9, 6, 10)] });

      render(<WeeklyConsistencySection />);

      expect(await screen.findByText('2편')).toBeInTheDocument();
      expect(barHeightOf(1)).toBeCloseTo(100);
      expect(screen.getByText(/총 2편/)).toBeInTheDocument();
    });

    it('개발일지만 발행했다면 어느 주차에도 반영되지 않고 개발일지 경로는 호출되지 않아야 한다', async () => {
      setToday(2026, 10, 14);
      mockPosts({ DEV_LOG: [new Date(2026, 9, 9, 10)] });

      render(<WeeklyConsistencySection />);

      expect(await screen.findByText(/총 0편/)).toBeInTheDocument();
      const requestedTypes = mockedFetchPostList.mock.calls.map(([params]) => params.type);
      expect(requestedTypes.sort()).toEqual(['LAB', 'PROJECT']);
    });

    it('지난달 말에 발행한 글은 이번 달 어느 주차에도 반영되지 않아야 한다', async () => {
      setToday(2026, 10, 14);
      mockPosts({ PROJECT: [new Date(2026, 8, 30, 23, 59)] });

      render(<WeeklyConsistencySection />);

      expect(await screen.findByText(/총 0편/)).toBeInTheDocument();
    });
  });

  describe('주차 경계 표시 (이슈 3)', () => {
    it('오늘이 10일이면 2주차까지는 "n편", 3주차 이후는 "-"와 빈 막대로 표시되어야 한다', async () => {
      setToday(2026, 10, 10);
      mockPosts({ PROJECT: [new Date(2026, 9, 3, 10)], LAB: [new Date(2026, 9, 9, 10)] });

      render(<WeeklyConsistencySection />);

      // 1주차 1편, 2주차(오늘이 속한 주) 1편
      expect(await screen.findAllByText('1편')).toHaveLength(2);
      expect(screen.getAllByText('-')).toHaveLength(3);
      expect(barHeightOf(2)).toBeCloseTo(100);
      expect(barHeightOf(3)).toBe(0);
      expect(barHeightOf(4)).toBe(0);
      expect(barHeightOf(5)).toBe(0);
    });

    it('이번 달이 31일까지 있으면 5주차 칸이 표시되어야 한다', async () => {
      setToday(2026, 10, 30);
      mockPosts({});

      render(<WeeklyConsistencySection />);

      expect(await screen.findByText('5주')).toBeInTheDocument();
      expect(screen.getAllByTestId(/^week-bar-/)).toHaveLength(5);
    });

    it('이번 달이 28일까지만 있으면(비윤년 2월) 4주차까지만 표시되고 5주차 칸은 없어야 한다', async () => {
      setToday(2026, 2, 10);
      mockPosts({});

      render(<WeeklyConsistencySection />);

      expect(await screen.findByText('4주')).toBeInTheDocument();
      expect(screen.getAllByTestId(/^week-bar-/)).toHaveLength(4);
      expect(screen.queryByText('5주')).not.toBeInTheDocument();
    });

    it('이번 달에 발행한 글이 한 편도 없으면 "총 0편"이 표시되고 에러 없이 막대가 비어 있어야 한다', async () => {
      setToday(2026, 10, 14);
      mockPosts({});

      render(<WeeklyConsistencySection />);

      expect(await screen.findByText(/총 0편/)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      for (const week of [1, 2, 3, 4, 5]) {
        expect(barHeightOf(week)).toBe(0);
      }
    });
  });

  describe('조회 중과 실패 (이슈 2)', () => {
    it('프로젝트는 성공하고 랩이 실패하면 막대 대신 에러 문구가 보이고 프로젝트 글의 편수는 표시되지 않아야 한다', async () => {
      setToday(2026, 10, 14);
      mockPosts({ PROJECT: [new Date(2026, 9, 2, 10)] }, ['LAB']);

      render(<WeeklyConsistencySection />);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByTestId('week-bar-1')).not.toBeInTheDocument();
      expect(screen.queryByText(/\d편/)).not.toBeInTheDocument();
    });

    it('에러 상태에서 "다시 시도"를 누르면 스피너를 거쳐 성공 시 주차별 막대가 표시되어야 한다', async () => {
      setToday(2026, 10, 14);
      const user = userEvent.setup();
      mockPosts({ PROJECT: [new Date(2026, 9, 2, 10)] }, ['LAB']);

      render(<WeeklyConsistencySection />);
      await user.click(await screen.findByRole('button', { name: '다시 시도' }));

      // 두 번째 조회는 사용자가 직접 끝내는 시점까지 대기시켜 스피너 상태를 관찰한다
      let finishReload: () => void = () => {};
      const reloadGate = new Promise<void>(resolve => {
        finishReload = resolve;
      });
      mockedFetchPostList.mockImplementation(async ({ type }) => {
        await reloadGate;
        return makeResponse(type === 'PROJECT' ? [makeItem('p1', new Date(2026, 9, 2, 10))] : []);
      });
      await user.click(await screen.findByRole('button', { name: '다시 시도' }));

      expect(await screen.findByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      finishReload();

      await waitFor(() => expect(screen.getByTestId('week-bar-1')).toBeInTheDocument());
      expect(screen.queryByRole('status', { name: '불러오는 중' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('1편')).toBeInTheDocument();
    });
  });
});
