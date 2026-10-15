import { describe, expect, it } from 'vitest';
import { formatElapsedDays } from '../elapsed-days';

describe('formatElapsedDays', () => {
  // 로컬 시간으로 만들어 실행 환경의 시간대에 영향받지 않게 한다
  const now = new Date('2026-10-15T12:00:00');

  it('같은 날이면 오늘을 돌려준다', () => {
    expect(formatElapsedDays('2026-10-15T09:00:00', now)).toBe('오늘');
  });

  it('하루 이상 지났으면 N일 전을 돌려준다', () => {
    expect(formatElapsedDays('2026-10-14T12:00:00', now)).toBe('1일 전');
    expect(formatElapsedDays('2026-09-03T12:00:00', now)).toBe('42일 전');
  });

  it('24시간이 안 지났어도 날짜가 다르면 1일 전이다', () => {
    const justAfterMidnight = new Date('2026-10-15T00:01:00');

    expect(formatElapsedDays('2026-10-14T23:59:00', justAfterMidnight)).toBe('1일 전');
  });

  it('미래 날짜는 오늘로 취급한다', () => {
    expect(formatElapsedDays('2026-10-16T12:00:00', now)).toBe('오늘');
  });
});
