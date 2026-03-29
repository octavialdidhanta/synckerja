export function matchesTimeFilter(meetingDateStr: string, timeFilter: string): boolean {
  if (!timeFilter) return true;
  const d = new Date(meetingDateStr);
  const n = new Date();
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const pointDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const oneDayMs = 24 * 60 * 60 * 1000;

  switch (timeFilter) {
    case 'Today':
      return pointDay.getTime() === today.getTime();
    case 'Yesterday': {
      const yesterday = new Date(today.getTime() - oneDayMs);
      return pointDay.getTime() === yesterday.getTime();
    }
    case 'This Week': {
      const dayOfWeek = n.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return pointDay >= weekStart && pointDay <= weekEnd;
    }
    case 'This Month':
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    case 'Last Month': {
      const lastMonth = n.getMonth() === 0 ? 11 : n.getMonth() - 1;
      const lastMonthYear = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    }
    default:
      return true;
  }
}
