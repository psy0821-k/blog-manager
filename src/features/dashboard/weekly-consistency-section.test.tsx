import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-client';
import type { FetchState } from '../../lib/use-fetch';
import { useWeeklyPostCounts } from './use-weekly-post-counts';
import { WeeklyConsistencySection } from './weekly-consistency-section';
import type { WeeklyPostCount } from './weekly-post-counts';

vi.mock('./use-weekly-post-counts', () => ({ useWeeklyPostCounts: vi.fn() }));

const mockedUseWeeklyPostCounts = vi.mocked(useWeeklyPostCounts);

function mockState(state: FetchState<WeeklyPostCount[]>, reload: () => void = vi.fn()) {
  mockedUseWeeklyPostCounts.mockReturnValue({ state, reload });
}

const ERROR_STATE: FetchState<WeeklyPostCount[]> = {
  status: 'error',
  error: new ApiError(500, '요청에 실패했습니다. (500)'),
};
const ERROR_MESSAGE = '주차별 발행 현황을 불러오지 못했습니다.';

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

  it('에러이면 카드 제목과 월 라벨은 보이고 에러 문구가 alert로 표시되어야 한다', () => {
    mockState(ERROR_STATE);

    render(<WeeklyConsistencySection />);

    expect(screen.getByText('주차별 성실도')).toBeInTheDocument();
    expect(screen.getByText('2026년 10월')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGE);
  });

  it('에러이면 주차별 막대와 편수가 보이지 않아야 한다', () => {
    mockState(ERROR_STATE);

    render(<WeeklyConsistencySection />);

    expect(screen.queryByTestId('week-bar-1')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d편/)).not.toBeInTheDocument();
  });

  it('에러이면 "다시 시도" 버튼이 보여야 한다', () => {
    mockState(ERROR_STATE);

    render(<WeeklyConsistencySection />);

    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('"다시 시도"를 누르면 reload가 한 번 호출되어야 한다', async () => {
    const reload = vi.fn();
    mockState(ERROR_STATE, reload);
    // 가짜 타이머가 Date만 대체하므로 userEvent도 그대로 쓸 수 있다
    const user = userEvent.setup();

    render(<WeeklyConsistencySection />);
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('에러 후 다시 로딩 상태가 되면 에러 문구가 사라지고 스피너가 보여야 한다', () => {
    mockState(ERROR_STATE);
    const { rerender } = render(<WeeklyConsistencySection />);

    mockState({ status: 'loading' });
    rerender(<WeeklyConsistencySection />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument();
  });

  it('다시 로딩 후 성공하면 에러 문구 없이 주차별 막대가 보여야 한다', () => {
    mockState(ERROR_STATE);
    const { rerender } = render(<WeeklyConsistencySection />);

    mockState({ status: 'success', data: [{ week: 1, count: 1, isFuture: false }] });
    rerender(<WeeklyConsistencySection />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('week-bar-1')).toBeInTheDocument();
  });

  it('로딩 중이거나 성공일 때는 에러 문구와 "다시 시도" 버튼이 보이지 않아야 한다', () => {
    mockState({ status: 'loading' });
    const { rerender } = render(<WeeklyConsistencySection />);
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();

    mockState({ status: 'success', data: [{ week: 1, count: 1, isFuture: false }] });
    rerender(<WeeklyConsistencySection />);

    expect(screen.queryByText(ERROR_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});
