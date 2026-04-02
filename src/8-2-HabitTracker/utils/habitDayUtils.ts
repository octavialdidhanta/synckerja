import { format } from "date-fns";

export type HabitForDay = {
  id: string;
  is_active?: boolean;
  frequency: string;
  weekly_days?: number[] | unknown;
  monthly_dates?: number[] | unknown;
  target_count?: number;
};

export type HabitEntryForDay = {
  habit_id: string;
  entry_date: string;
};

export function isHabitActiveOnDay(habit: HabitForDay, day: Date): boolean {
  if (!habit.is_active) return false;
  if (habit.frequency === "weekly") {
    if (habit.weekly_days && Array.isArray(habit.weekly_days) && habit.weekly_days.length > 0) {
      const dayOfWeek = day.getDay();
      const weeklyDaysNumbers = habit.weekly_days.map((d: unknown) => Number(d));
      return weeklyDaysNumbers.includes(dayOfWeek);
    }
    return true;
  }
  if (habit.frequency === "monthly") {
    if (habit.monthly_dates && Array.isArray(habit.monthly_dates) && habit.monthly_dates.length > 0) {
      const dayOfMonth = Number.parseInt(format(day, "d"), 10);
      const monthlyDatesNumbers = habit.monthly_dates.map((d: unknown) => Number(d));
      return monthlyDatesNumbers.includes(dayOfMonth);
    }
    return false;
  }
  return true;
}

export function isHabitCompletedOnDay(habit: HabitForDay, day: Date, entriesList: HabitEntryForDay[]): boolean {
  if (!habit.is_active) return false;
  const dateStr = format(day, "yyyy-MM-dd");
  const dayEntries = entriesList.filter((e) => e.habit_id === habit.id && e.entry_date === dateStr);
  if (habit.frequency === "monthly" || habit.frequency === "weekly") return dayEntries.length > 0;
  if (habit.target_count && habit.target_count > 1) return dayEntries.length >= habit.target_count;
  return dayEntries.length > 0;
}
