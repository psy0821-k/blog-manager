import { describe, expect, it } from 'vitest';
import { aggregateWeeklyPostCounts, formatMonthLabel, getWeekOfMonth } from '../weekly-post-counts';

/** 로컬 시간 기준 날짜로 createdAt(ISO 문자열)을 가진 글 하나를 만든다. */
function makePost(year: number, month: number, day: number, hour = 12, minute = 0, second = 0) {
  return { createdAt: new Date(year, month - 1, day, hour, minute, second).toISOString() };
}

function countsOf(weeks: ReturnType<typeof aggregateWeeklyPostCounts>) {
  return weeks.map(week => week.count);
}

describe('getWeekOfMonth', () => {
  it('1일, 7일이면 1주차를 반환해야 한다', () => {
    expect(getWeekOfMonth(1)).toBe(1);
    expect(getWeekOfMonth(7)).toBe(1);
  });

  it('8일, 14일이면 2주차를 반환해야 한다', () => {
    expect(getWeekOfMonth(8)).toBe(2);
    expect(getWeekOfMonth(14)).toBe(2);
  });

  it('15일, 21일이면 3주차, 22일, 28일이면 4주차를 반환해야 한다', () => {
    expect(getWeekOfMonth(15)).toBe(3);
    expect(getWeekOfMonth(21)).toBe(3);
    expect(getWeekOfMonth(22)).toBe(4);
    expect(getWeekOfMonth(28)).toBe(4);
  });

  it('29일, 31일이면 5주차를 반환해야 한다', () => {
    expect(getWeekOfMonth(29)).toBe(5);
    expect(getWeekOfMonth(31)).toBe(5);
  });
});

describe('formatMonthLabel', () => {
  it('2026년 10월 날짜이면 "2026년 10월"을 반환해야 한다', () => {
    expect(formatMonthLabel(new Date(2026, 9, 14))).toBe('2026년 10월');
  });

  it('1월과 12월도 앞에 0을 붙이지 않고 "2026년 1월", "2026년 12월"로 반환해야 한다', () => {
    expect(formatMonthLabel(new Date(2026, 0, 5))).toBe('2026년 1월');
    expect(formatMonthLabel(new Date(2026, 11, 5))).toBe('2026년 12월');
  });
});

describe('aggregateWeeklyPostCounts', () => {
  // 2026년 10월은 31일까지 있고, 14일은 2주차에 속한다
  const now = new Date(2026, 9, 14, 12);

  it('이번 달 1~7일에 글 2편이 있으면 1주차 count가 2여야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([makePost(2026, 10, 2), makePost(2026, 10, 6)], now);

    expect(weeks[0]).toMatchObject({ week: 1, count: 2 });
  });

  it('서로 다른 주차에 글이 있으면 각 글이 자기 주차 count에만 반영되어야 한다', () => {
    const weeks = aggregateWeeklyPostCounts(
      [makePost(2026, 10, 3), makePost(2026, 10, 9), makePost(2026, 10, 10), makePost(2026, 10, 30)],
      now,
    );

    expect(countsOf(weeks)).toEqual([1, 2, 0, 0, 1]);
  });

  it('글이 없는 주차의 count는 0이어야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([makePost(2026, 10, 3)], now);

    expect(weeks[1].count).toBe(0);
    expect(weeks[2].count).toBe(0);
  });

  it('반환 배열은 1주차부터 주차 순서대로 정렬되어 있어야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([makePost(2026, 10, 30), makePost(2026, 10, 3)], now);

    expect(weeks.map(week => week.week)).toEqual([1, 2, 3, 4, 5]);
  });

  it('7일 23:59:59의 글은 1주차, 8일 00:00:00의 글은 2주차로 계산해야 한다', () => {
    const weeks = aggregateWeeklyPostCounts(
      [makePost(2026, 10, 7, 23, 59, 59), makePost(2026, 10, 8, 0, 0, 0)],
      now,
    );

    expect(countsOf(weeks).slice(0, 2)).toEqual([1, 1]);
  });

  it('이번 달 1일 00:00:00과 말일 23:59:59의 글이 모두 이번 달에 포함되어야 한다', () => {
    const weeks = aggregateWeeklyPostCounts(
      [makePost(2026, 10, 1, 0, 0, 0), makePost(2026, 10, 31, 23, 59, 59)],
      now,
    );

    expect(weeks[0].count).toBe(1);
    expect(weeks[4].count).toBe(1);
  });

  it('지난달 말일의 글은 어느 주차에도 반영되지 않아야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([makePost(2026, 9, 30, 23, 59, 59)], now);

    expect(countsOf(weeks)).toEqual([0, 0, 0, 0, 0]);
  });

  it('작년 같은 달의 글은 어느 주차에도 반영되지 않아야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([makePost(2025, 10, 5)], now);

    expect(countsOf(weeks)).toEqual([0, 0, 0, 0, 0]);
  });

  it('말일이 31일인 달이면 5개 주차를 반환해야 한다', () => {
    expect(aggregateWeeklyPostCounts([], now)).toHaveLength(5);
  });

  it('말일이 28일인 달(비윤년 2월)이면 4개 주차를 반환해야 한다', () => {
    expect(aggregateWeeklyPostCounts([], new Date(2026, 1, 10, 12))).toHaveLength(4);
  });

  it('글 목록이 비어 있으면 모든 주차의 count가 0인 배열을 반환해야 한다', () => {
    expect(countsOf(aggregateWeeklyPostCounts([], now))).toEqual([0, 0, 0, 0, 0]);
  });

  it('오늘 이후 주차는 isFuture가 true이고 오늘이 속한 주차까지는 false여야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([], now);

    expect(weeks.map(week => week.isFuture)).toEqual([false, false, true, true, true]);
  });

  it('파싱할 수 없는 createdAt은 건너뛰고 나머지 글만 집계해야 한다', () => {
    const weeks = aggregateWeeklyPostCounts([{ createdAt: 'not-a-date' }, makePost(2026, 10, 3)], now);

    expect(countsOf(weeks)).toEqual([1, 0, 0, 0, 0]);
  });

  it('입력 배열을 변경하지 않아야 한다', () => {
    const posts = [makePost(2026, 10, 30), makePost(2026, 10, 3)];
    const snapshot = structuredClone(posts);

    aggregateWeeklyPostCounts(posts, now);

    expect(posts).toEqual(snapshot);
  });
});
