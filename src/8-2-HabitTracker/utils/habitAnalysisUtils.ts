import { endOfMonth, startOfMonth } from "date-fns";

export type HabitForAnalysis = {
  id: string;
  frequency: string;
  target_count?: number;
};

export type EntryForAnalysis = {
  habit_id: string;
  entry_date: string;
};

export function getHabitAnalysis(
  habit: HabitForAnalysis,
  monthDays: Date[],
  entries: EntryForAnalysis[],
): { goal: number; actual: number; progress: number } {
  const totalDays = monthDays.length;
  if (totalDays === 0) return { goal: 0, actual: 0, progress: 0 };
  const monthStart = startOfMonth(monthDays[0]);
  const monthEnd = endOfMonth(monthDays[monthDays.length - 1]);
  const tc = habit.target_count ?? 1;
  let goal = 0;
  if (habit.frequency === "daily") goal = totalDays * tc;
  else if (habit.frequency === "weekly") {
    const firstDay = monthStart.getDay();
    const daysInFirstWeek = 7 - firstDay;
    const remainingDays = totalDays - daysInFirstWeek;
    const fullWeeks = Math.floor(remainingDays / 7);
    const daysInLastWeek = remainingDays % 7;
    const weeksInMonth = (daysInFirstWeek > 0 ? 1 : 0) + fullWeeks + (daysInLastWeek > 0 ? 1 : 0);
    goal = weeksInMonth * tc;
  } else if (habit.frequency === "monthly") goal = tc;
  const actual = entries.filter((e) => {
    if (e.habit_id !== habit.id) return false;
    const d = new Date(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  }).length;
  const progress = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;
  return { goal, actual, progress };
}

export function getTotalMonthlyGoal(habits: HabitForAnalysis[], monthDays: Date[]): number {
  const totalDays = monthDays.length;
  if (totalDays === 0) return 0;
  const monthStart = startOfMonth(monthDays[0]);
  let totalGoal = 0;
  for (const habit of habits) {
    const tc = habit.target_count ?? 1;
    if (habit.frequency === "daily") totalGoal += totalDays * tc;
    else if (habit.frequency === "weekly") {
      const firstDay = monthStart.getDay();
      const daysInFirstWeek = 7 - firstDay;
      const remainingDays = totalDays - daysInFirstWeek;
      const fullWeeks = Math.floor(remainingDays / 7);
      const daysInLastWeek = remainingDays % 7;
      const weeksInMonth = (daysInFirstWeek > 0 ? 1 : 0) + fullWeeks + (daysInLastWeek > 0 ? 1 : 0);
      totalGoal += weeksInMonth * tc;
    } else if (habit.frequency === "monthly") totalGoal += tc;
  }
  return totalGoal;
}
