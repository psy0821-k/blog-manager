const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatElapsedDays(isoDate: string, now: Date): string {
  const elapsedMs = startOfDay(now).getTime() - startOfDay(new Date(isoDate)).getTime();
  // 서머타임으로 하루가 23~25시간이 될 수 있어 반올림한다. 미래 날짜는 0으로 맞춘다
  const elapsedDays = Math.max(0, Math.round(elapsedMs / MS_PER_DAY));

  return elapsedDays === 0 ? '오늘' : `${elapsedDays}일 전`;
}
