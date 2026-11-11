const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export function scheduleMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function circularGapMinutes(left: string, right: string): number | null {
  const first = scheduleMinutes(left);
  const second = scheduleMinutes(right);
  if (first == null || second == null) return null;
  const diff = Math.abs(first - second);
  return Math.min(diff, 1440 - diff);
}

export function canAddScheduleTime(times: string[], next: string): boolean {
  if (scheduleMinutes(next) == null) return false;
  if (times.length >= 7) return false;
  if (times.includes(next)) return false;
  return times.every((time) => {
    const gap = circularGapMinutes(time, next);
    return gap != null && gap >= 60;
  });
}
