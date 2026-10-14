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

  it('로딩 중이거나 에러이면 이슈 2 전까지 카드를 렌더링하지 않아야 한다', () => {
    mockState({ status: 'loading' });
    const { container, rerender } = render(<WeeklyConsistencySection />);
    expect(container).toBeEmptyDOMElement();

    mockState({ status: 'error', error: new ApiError(500, '요청에 실패했습니다. (500)') });
    rerender(<WeeklyConsistencySection />);
    expect(container).toBeEmptyDOMElement();
  });
});
