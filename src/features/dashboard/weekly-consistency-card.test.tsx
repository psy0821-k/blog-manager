import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyConsistencyCard } from './weekly-consistency-card';
import type { WeeklyPostCount } from './weekly-post-counts';

const MONTH_LABEL = '2026년 10월';

function makeWeeks(counts: number[], futureFrom = counts.length + 1): WeeklyPostCount[] {
  return counts.map((count, index) => ({ week: index + 1, count, isFuture: index + 1 >= futureFrom }));
}

/** 막대의 style.height(%)를 숫자로 읽는다. */
function barHeightOf(week: number): number {
  return parseFloat(screen.getByTestId(`week-bar-${week}`).style.height);
}

describe('WeeklyConsistencyCard', () => {
  it('주차별 count가 "n편"으로 표시되어야 한다', () => {
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([3, 1, 0])} />);

    expect(screen.getByText('3편')).toBeInTheDocument();
    expect(screen.getByText('1편')).toBeInTheDocument();
    expect(screen.getByText('0편')).toBeInTheDocument();
  });

  it('요약에 월 라벨, "총 N편", "글 올린 주 M/K주"가 표시되어야 한다', () => {
    // 4편 / 3주 시작 중 2개 주에 글이 있고, 4~5주차는 아직 지나지 않음
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([3, 1, 0, 0, 0], 4)} />);

    expect(screen.getByText(/2026년 10월/)).toBeInTheDocument();
    expect(screen.getByText(/총 4편/)).toBeInTheDocument();
    expect(screen.getByText(/글 올린 주 2\/3주/)).toBeInTheDocument();
  });

  it('편수가 가장 많은 주의 막대가 가장 높고 나머지는 그 비율로 낮아야 한다', () => {
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([4, 2, 1])} />);

    expect(barHeightOf(1)).toBeCloseTo(100);
    expect(barHeightOf(2)).toBeCloseTo(50);
    expect(barHeightOf(3)).toBeCloseTo(25);
  });

  it('지나지 않은 주차는 편수 대신 "-"로 표시되어야 한다', () => {
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([2, 1, 0, 0, 0], 3)} />);

    expect(screen.getByText('2편')).toBeInTheDocument();
    expect(screen.getByText('1편')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(3);
    expect(screen.queryByText('0편')).not.toBeInTheDocument();
  });

  it('모든 주차가 0편이면 "총 0편"이 표시되고 막대 높이가 0이어야 한다', () => {
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([0, 0, 0])} />);

    expect(screen.getByText(/총 0편/)).toBeInTheDocument();
    expect(barHeightOf(1)).toBe(0);
    expect(barHeightOf(2)).toBe(0);
    expect(barHeightOf(3)).toBe(0);
  });

  it('최대 편수가 1편이어도 그 주의 막대가 가득 차야 한다', () => {
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([1, 0])} />);

    expect(barHeightOf(1)).toBeCloseTo(100);
    expect(barHeightOf(2)).toBe(0);
  });

  it('목표 편수나 달성/미달 문구("달성", "목표")가 표시되지 않아야 한다', () => {
    render(<WeeklyConsistencyCard monthLabel={MONTH_LABEL} weeks={makeWeeks([3, 1, 0])} />);

    expect(screen.queryByText(/달성|목표/)).not.toBeInTheDocument();
  });
});
