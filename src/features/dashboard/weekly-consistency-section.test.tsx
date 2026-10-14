import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import type { FetchState } from '../../lib/use-fetch';
import { useWeeklyPostCounts } from './use-weekly-post-counts';
import { WeeklyConsistencySection } from './weekly-consistency-section';
import type { WeeklyPostCount } from './weekly-post-counts';

vi.mock('./use-weekly-post-counts', () => ({ useWeeklyPostCounts: vi.fn() }));

const mockedUseWeeklyPostCounts = vi.mocked(useWeeklyPostCounts);

function mockState(state: FetchState<WeeklyPostCount[]>) {
  mockedUseWeeklyPostCounts.mockReturnValue({ state, reload: vi.fn() });
}

describe('WeeklyConsistencySection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 14, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('조회가 성공하면 월 라벨과 주차별 편수를 가진 카드를 렌더링해야 한다', () => {
    mockState({
      status: 'success',
      data: [
        { week: 1, count: 2, isFuture: false },
        { week: 2, count: 1, isFuture: false },
        { week: 3, count: 0, isFuture: true },
      ],
    });

    render(<WeeklyConsistencySection />);

    expect(screen.getByText('주차별 성실도')).toBeInTheDocument();
    expect(screen.getByText(/2026년 10월/)).toBeInTheDocument();
    expect(screen.getByText('2편')).toBeInTheDocument();
    expect(screen.getByText('1편')).toBeInTheDocument();
  });

  it('로딩 중이면 카드 제목과 월 라벨은 보이고 그래프 대신 로딩 스피너가 보여야 한다', () => {
    mockState({ status: 'loading' });

    render(<WeeklyConsistencySection />);

    expect(screen.getByText('주차별 성실도')).toBeInTheDocument();
    expect(screen.getByText('2026년 10월')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
  });

  it('로딩 중이면 주차별 막대와 편수는 보이지 않아야 한다', () => {
    mockState({ status: 'loading' });

    render(<WeeklyConsistencySection />);

    expect(screen.queryByTestId('week-bar-1')).not.toBeInTheDocument();
    expect(screen.queryByText(/편/)).not.toBeInTheDocument();
  });

  it('조회가 성공하면 로딩 스피너는 보이지 않아야 한다', () => {
    mockState({ status: 'success', data: [{ week: 1, count: 1, isFuture: false }] });

    render(<WeeklyConsistencySection />);

    expect(screen.queryByRole('status', { name: '불러오는 중' })).not.toBeInTheDocument();
  });

  it('에러이면 에러 표시가 추가되기 전까지 카드를 렌더링하지 않아야 한다', () => {
    mockState({ status: 'error', error: new ApiError(500, '요청에 실패했습니다. (500)') });

    const { container } = render(<WeeklyConsistencySection />);

    expect(container).toBeEmptyDOMElement();
  });
});
