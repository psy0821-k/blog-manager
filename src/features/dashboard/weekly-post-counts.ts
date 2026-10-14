import type { PostListItem } from '../posts/post-types';

export interface WeeklyPostCount {
  week: number;
  count: number;
  /** 오늘이 속한 주 이후 */
  isFuture: boolean;
}

const DAYS_PER_WEEK = 7;

/** 해당 월의 일(1~31)이 몇 주차인지 반환한다. 1~7일=1주 … 29일~=5주 */
export function getWeekOfMonth(day: number): number {
  return Math.ceil(day / DAYS_PER_WEEK);
}

/** 'YYYY년 M월' 형식의 월 라벨 */
export function formatMonthLabel(now: Date): string {
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

/**
 * now가 속한 달의 주차별 발행 편수를 만든다. 주차 수는 그 달 말일로 정해진다(28일=4주, 29일 이상=5주).
 * 브라우저 로컬 시간 기준이며, 이번 달이 아니거나 파싱할 수 없는 createdAt은 건너뛴다.
 */
export function aggregateWeeklyPostCounts(
  posts: ReadonlyArray<Pick<PostListItem, 'createdAt'>>,
  now: Date,
): WeeklyPostCount[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const currentWeek = getWeekOfMonth(now.getDate());
  const counts = Array.from({ length: getWeekOfMonth(lastDay) }, () => 0);

  for (const post of posts) {
    const createdAt = new Date(post.createdAt);
    const isThisMonth = createdAt.getFullYear() === year && createdAt.getMonth() === month;

    // 날짜를 파싱할 수 없으면 getFullYear()가 NaN이라 isThisMonth가 false가 된다
    if (isThisMonth) {
      counts[getWeekOfMonth(createdAt.getDate()) - 1] += 1;
    }
  }

  return counts.map((count, index) => ({ week: index + 1, count, isFuture: index + 1 > currentWeek }));
}

export interface WeeklyPostSummary {
  /** 모든 주차의 발행 편수 합 */
  totalCount: number;
  /** 이미 시작된 주차 중 글을 올린 주차의 수 */
  activeWeekCount: number;
  /** 지나지 않은 주차를 뺀, 이미 시작된 주차의 수 */
  startedWeekCount: number;
}

/** 주차별 편수를 카드 요약에 쓰는 세 가지 숫자로 줄인다. */
export function summarizeWeeklyPostCounts(weeks: ReadonlyArray<WeeklyPostCount>): WeeklyPostSummary {
  const startedWeeks = weeks.filter(week => !week.isFuture);

  return {
    totalCount: weeks.reduce((sum, week) => sum + week.count, 0),
    activeWeekCount: startedWeeks.filter(week => week.count > 0).length,
    startedWeekCount: startedWeeks.length,
  };
}
