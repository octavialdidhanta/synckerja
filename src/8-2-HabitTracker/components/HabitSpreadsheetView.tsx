import React, { useState, useMemo, useRef, useEffect } from "react";
import { useHabitTracker } from "../context/HabitTrackerContext";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Target } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { HabitFormModal } from "./HabitFormModal";
import { HabitTargetCountModal } from "./HabitTargetCountModal";
import { isHabitActiveOnDay, isHabitCompletedOnDay } from "../utils/habitDayUtils";
import { getHabitAnalysis, getTotalMonthlyGoal } from "../utils/habitAnalysisUtils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isAfter, isSameMonth } from "date-fns";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export const HabitSpreadsheetView = () => {
  const { filteredHabits, entries, addEntry, deleteEntry, deleteHabit, updateHabit } = useHabitTracker();
  const { toast } = useToast();
  const { t, dateLocale } = useAppTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<{ id: string; name: string } | null>(null);
  const [targetCountModal, setTargetCountModal] = useState<{ habitId: string; date: Date } | null>(null);
  const [monthlyHabitConfirmModal, setMonthlyHabitConfirmModal] = useState<{ habitId: string; date: Date; newDate: number; oldDate: number | null } | null>(
    null,
  );
  const [selectedOldDate, setSelectedOldDate] = useState<number | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);

  const HABIT_NAME_CELL_WIDTH = 250;
  const ACTIONS_WIDTH = 56;
  const ACTIONS_PADDING_RIGHT = 12;
  const ACTIONS_TOTAL_WIDTH = ACTIONS_WIDTH + ACTIONS_PADDING_RIGHT;
  const handleToggleActionsReveal = (habitId: string) => {
    setExpandedHabitId((prev) => (prev === habitId ? null : habitId));
  };
  const unifiedScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .habit-grid-checkbox-checked[data-state="checked"] {
        background-color: hsl(var(--primary)) !important;
        border-color: hsl(var(--primary)) !important;
      }
      .habit-grid-checkbox-checked[data-state="checked"] svg {
        color: hsl(var(--primary-foreground)) !important;
      }
      .habit-grid-checkbox {
        border-radius: 2px !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEntryForDate = (habitId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return entries.find((e) => e.habit_id === habitId && e.entry_date === dateStr);
  };

  const getEntriesCountForDate = (habitId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return entries.filter((e) => e.habit_id === habitId && e.entry_date === dateStr).length;
  };

  const getHabitAnalysisForRow = (habit: (typeof filteredHabits)[number]) => getHabitAnalysis(habit, monthDays, entries);
  const getTotalMonthlyGoalForStats = () => getTotalMonthlyGoal(filteredHabits, monthDays);

  const getDailyStatsAnalysis = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayEntries = entries.filter((e) => e.entry_date === dateStr);

    let goal = 0;
    filteredHabits.forEach((habit) => {
      if (habit.frequency === "daily") goal += habit.target_count;
      else if (habit.frequency === "weekly") goal += habit.target_count / 7;
      else if (habit.frequency === "monthly") goal += habit.target_count / monthDays.length;
    });

    const actual = dayEntries.length;
    const progress = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;
    return { goal: Math.round(goal), actual, progress };
  };

  const chartData = useMemo(
    () =>
      monthDays.map((day) => {
        const activeHabits = filteredHabits.filter((habit) => habit.is_active && isHabitActiveOnDay(habit, day));
        const totalHabits = activeHabits.length;
        const done = activeHabits.filter((habit) => isHabitCompletedOnDay(habit, day, entries)).length;
        return {
          date: format(day, "d"),
          dayName: format(day, "EEE"),
          done,
          left: Math.max(0, totalHabits - done),
          total: totalHabits,
          pct: totalHabits > 0 ? Math.round((done / totalHabits) * 100) : 0,
        };
      }),
    [monthDays, entries, filteredHabits],
  );

  const cumulativeConsistencyRate = useMemo(() => {
    const today = new Date();
    let totalCompleted = 0;
    let totalExpected = 0;
    chartData.forEach((row, index) => {
      const day = monthDays[index];
      if (!isSameMonth(day, currentMonth) || isAfter(day, today)) return;
      totalCompleted += row.done;
      totalExpected += row.total;
    });
    if (totalExpected === 0) return 0;
    return (totalCompleted / totalExpected) * 100;
  }, [chartData, monthDays, currentMonth]);

  const handleMonthlyHabitDateChange = (habitId: string, date: Date) => {
    const habit = filteredHabits.find((h) => h.id === habitId);
    if (!habit || habit.frequency !== "monthly") return;

    const dayOfMonth = Number.parseInt(format(date, "d"), 10);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthEntries = entries.filter((e) => {
      if (e.habit_id !== habit.id) return false;
      const entryDate = new Date(e.entry_date);
      return entryDate >= monthStart && entryDate <= monthEnd;
    });
    const currentEntriesCount = monthEntries.length;

    if (currentEntriesCount >= habit.target_count) {
      toast({
        title: t("habitTracker.monthlyHabit.limitReached", "Limit Tercapai"),
        description: t(
          "habitTracker.monthlyHabit.limitReachedDescription",
          "Anda sudah menyelesaikan {count} entry bulan ini. Silakan hapus entry yang ada terlebih dahulu.",
          { count: habit.target_count.toString() },
        ),
        variant: "destructive",
      });
      return;
    }

    let defaultOldDate: number | null = null;
    if (habit.monthly_dates && habit.monthly_dates.length > 0) {
      const checkedDates = monthEntries.map((e) => Number.parseInt(format(new Date(e.entry_date), "d"), 10));
      const availableOldDate = habit.monthly_dates.find((dateNum) => {
        const val = Number(dateNum);
        return val !== dayOfMonth && !checkedDates.includes(val);
      });
      if (availableOldDate) defaultOldDate = Number(availableOldDate);
    }

    setSelectedOldDate(defaultOldDate);
    setMonthlyHabitConfirmModal({ habitId, date, newDate: dayOfMonth, oldDate: defaultOldDate });
  };

  const handleCheckboxToggle = async (habitId: string, date: Date, checked: boolean) => {
    const habit = filteredHabits.find((h) => h.id === habitId);
    if (!habit) return;
    if (habit.frequency === "daily" && habit.target_count > 1) {
      setTargetCountModal({ habitId, date });
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");
    const existingEntry = getEntryForDate(habitId, date);
    try {
      if (checked && !existingEntry) {
        await addEntry(habitId, dateStr, 1);
        toast({ title: "Entry logged", description: `Habit logged for ${format(date, "MMM d")}` });
      } else if (!checked && existingEntry) {
        await deleteEntry(existingEntry.id);
        toast({ title: "Entry removed", description: `Entry removed for ${format(date, "MMM d")}` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update entry", variant: "destructive" });
    }
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm ring-1 ring-brand-blue/10">
      <div className="flex-shrink-0 border-b border-brand-blue/20 bg-brand-blue/[0.06] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Habit Tracker</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={goToPreviousMonth} className="h-7 w-7 p-0 hover:bg-brand-blue/10">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[140px] text-center text-gray-900">{format(currentMonth, "MMMM yyyy")}</span>
              <Button size="sm" variant="ghost" onClick={goToNextMonth} className="h-7 w-7 p-0 hover:bg-brand-blue/10">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Add Habit
          </Button>
        </div>
      </div>

      <div ref={unifiedScrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain relative flex flex-col">
        <div className="flex-1 flex flex-col min-h-0" style={{ minWidth: `calc(250px + ${monthDays.length * 45}px + 280px)` }}>
            <div className="flex-shrink-0">
              <table
                className="border-separate border-spacing-0 bg-white"
                style={{ width: "100%", minWidth: `calc(250px + ${monthDays.length * 45}px + 280px)`, tableLayout: "fixed" }}
              >
                <thead className="sticky top-0 z-[25] border-b border-brand-blue/20 bg-brand-blue-soft" style={{ boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)" }}>
                  <tr style={{ height: "45px" }}>
                    <th
                      className="sticky left-0 z-[50] border-b border-r border-brand-blue/20 bg-brand-blue-soft px-4 text-left text-sm font-semibold text-gray-700 shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
                      style={{ width: "250px", minWidth: "250px", height: "45px", verticalAlign: "middle", paddingTop: "8px", paddingBottom: "8px" }}
                    >
                      Habit Name
                    </th>
                    {monthDays.map((day) => {
                      const isCurrentDay = isToday(day);
                      return (
                        <th
                          key={day.toISOString()}
                          className={`relative z-0 border-b border-r border-brand-blue/20 px-1 text-center text-xs font-medium text-gray-700 ${isCurrentDay ? "bg-brand-blue-soft brightness-[0.97]" : "bg-brand-blue-soft"}`}
                          style={{ width: "45px", minWidth: "45px", height: "45px", verticalAlign: "middle", paddingTop: "8px", paddingBottom: "8px" }}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase">{format(day, "EEE")}</span>
                            <span className={`text-sm font-semibold ${isCurrentDay ? "text-primary" : "text-gray-900"}`}>{format(day, "d")}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th
                      className="relative z-0 border-b border-r border-gray-300 bg-gray-100 px-3 text-center text-xs font-semibold text-gray-700"
                      style={{ width: "80px", minWidth: "80px", height: "45px", verticalAlign: "middle", paddingTop: "8px", paddingBottom: "8px" }}
                    >
                      Goal
                    </th>
                    <th
                      className="relative z-0 border-b border-r border-gray-300 bg-gray-100 px-3 text-center text-xs font-semibold text-gray-700"
                      style={{ width: "80px", minWidth: "80px", height: "45px", verticalAlign: "middle", paddingTop: "8px", paddingBottom: "8px" }}
                    >
                      Actual
                    </th>
                    <th
                      className="relative z-0 border-b border-gray-300 bg-gray-100 px-3 text-center text-xs font-semibold text-gray-700"
                      style={{ width: "120px", minWidth: "120px", height: "45px", verticalAlign: "middle", paddingTop: "8px", paddingBottom: "8px" }}
                    >
                      Progress
                    </th>
                  </tr>
                  <tr className="border-y border-brand-blue/20 bg-brand-blue-soft" style={{ height: "45px" }}>
                    <td
                      className="sticky left-0 z-[40] border-b border-r border-brand-blue/20 bg-brand-blue-soft px-4 shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
                      style={{ width: "250px", minWidth: "250px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}
                    >
                      <span className="text-xs font-semibold text-gray-700">Daily Stats</span>
                    </td>
                    {chartData.map((dayData, index) => {
                      const day = monthDays[index];
                      const isCurrentDay = isToday(day);
                      const percentage = dayData.total > 0 ? Math.round((dayData.done / dayData.total) * 100) : 0;
                      const isComplete = percentage === 100;
                      return (
                        <td
                          key={`stats-${day.toISOString()}`}
                          className={`relative z-0 border-b border-r border-brand-blue/20 px-1 text-center ${isCurrentDay ? "bg-brand-blue-soft brightness-[0.97]" : "bg-brand-blue-soft"}`}
                          style={{ width: "45px", minWidth: "45px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <div
                              className={`text-[10px] font-bold ${isComplete ? "rounded bg-primary px-1.5 py-0.5 text-primary-foreground" : "text-gray-700"}`}
                            >
                              {percentage}%
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="relative z-0 border-b border-r border-gray-300 bg-gray-50 px-2 text-center" style={{ width: "80px", minWidth: "80px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}>
                      <div className="flex items-center justify-center gap-1">
                        <Target className="h-3 w-3 text-gray-500" />
                        <span className="text-xs font-semibold text-gray-900">{getTotalMonthlyGoalForStats()}</span>
                      </div>
                    </td>
                    <td className="relative z-0 border-b border-r border-gray-300 bg-gray-50 px-2 text-center" style={{ width: "80px", minWidth: "80px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}>
                      {(() => {
                        const totalGoal = getTotalMonthlyGoalForStats();
                        const totalActual = chartData.reduce((sum, _dayData, idx) => sum + getDailyStatsAnalysis(monthDays[idx]).actual, 0);
                        return (
                          <span className={`text-xs font-semibold ${totalActual >= totalGoal ? "text-primary" : totalActual >= totalGoal * 0.5 ? "text-primary" : "text-gray-900"}`}>
                            {totalActual}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="relative z-0 border-b border-gray-300 bg-gray-50 px-2" style={{ width: "120px", minWidth: "120px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}>
                      {(() => {
                        const totalGoal = getTotalMonthlyGoalForStats();
                        const totalActual = chartData.reduce((sum, _dayData, idx) => sum + getDailyStatsAnalysis(monthDays[idx]).actual, 0);
                        const totalProgress = totalGoal > 0 ? Math.min((totalActual / totalGoal) * 100, 100) : 0;
                        const progressColor = "bg-primary";
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div className={`${progressColor} h-2 rounded-full transition-all duration-300`} style={{ width: `${Math.min(totalProgress, 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-gray-700 min-w-[30px] text-right">{Math.round(totalProgress)}%</span>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredHabits.length === 0 ? (
                    <tr>
                      <td colSpan={monthDays.length + 4} className="px-4 py-12 text-center text-gray-500 border-b border-gray-200">
                        <div className="flex flex-col items-center gap-2">
                          <p>No habits found</p>
                          <Button onClick={() => setShowAddModal(true)} size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Your First Habit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHabits.map((habit, habitIndex) => {
                      const isSelected = selectedHabit === habit.id;
                      const _isLastRow = habitIndex === filteredHabits.length - 1;
                      return (
                        <tr key={habit.id} className="group transition-colors" onClick={() => setSelectedHabit(habit.id)} style={{ height: "45px" }}>
                          <td
                            className={`sticky left-0 z-[15] border-r border-gray-300 border-b border-gray-300 p-0 shadow-[2px_0_4px_rgba(0,0,0,0.08)] transition-colors ${
                              isSelected ? "bg-brand-blue-soft" : "bg-white group-hover:bg-slate-50"
                            }`}
                            style={{ width: "250px", minWidth: "250px", height: "45px", verticalAlign: "middle", overflow: "hidden" }}
                          >
                            <div className="overflow-hidden" style={{ width: HABIT_NAME_CELL_WIDTH }}>
                              <div
                                className="flex items-stretch transition-transform duration-150 ease-out"
                                style={{
                                  width: HABIT_NAME_CELL_WIDTH + ACTIONS_TOTAL_WIDTH,
                                  transform: expandedHabitId === habit.id ? `translateX(-${ACTIONS_TOTAL_WIDTH}px)` : "translateX(0)",
                                }}
                              >
                                <div className="flex items-center gap-2 flex-shrink-0 py-1.5 pl-3 pr-0" style={{ width: HABIT_NAME_CELL_WIDTH }}>
                                  <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300" style={{ backgroundColor: habit.color || "#3b82f6" }} />
                                  <span className="font-medium text-sm text-gray-900 flex-1 truncate min-w-0">{habit.name}</span>
                                  <button
                                    type="button"
                                    className="flex-shrink-0 ml-auto p-0.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleActionsReveal(habit.id);
                                    }}
                                    aria-label={expandedHabitId === habit.id ? t("habitTracker.closeActions", "Tutup aksi") : t("habitTracker.revealActions", "Tampilkan edit & hapus")}
                                  >
                                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedHabitId === habit.id ? "rotate-90" : ""}`} />
                                  </button>
                                </div>
                                <div className="flex items-center flex-shrink-0 bg-gray-100 border-l border-gray-300 pr-3" style={{ width: ACTIONS_TOTAL_WIDTH }}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-none hover:bg-gray-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedHabitId(null);
                                      setEditingHabit(habit.id);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-none text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedHabitId(null);
                                      setHabitToDelete({ id: habit.id, name: habit.name });
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </td>
                          {monthDays.map((day) => {
                            const entriesCount = getEntriesCountForDate(habit.id, day);
                            const isCurrentDay = isToday(day);
                            const isMultiEntry = habit.frequency === "daily" && habit.target_count > 1;
                            const isWeeklyHabit = habit.frequency === "weekly";
                            const isMonthlyHabit = habit.frequency === "monthly";
                            const isFull = entriesCount === habit.target_count;
                            const isPartial = entriesCount > 0 && entriesCount < habit.target_count;
                            const isDayAllowed = isHabitActiveOnDay(habit, day);
                            let checkboxState: boolean | "indeterminate";
                            if (isMultiEntry) checkboxState = isPartial ? "indeterminate" : isFull;
                            else checkboxState = entriesCount > 0;
                            return (
                              <td
                                key={`${habit.id}-${day.toISOString()}`}
                                className={`relative z-0 border-r border-b border-brand-blue/20 px-1 text-center transition-colors ${
                                  isDayAllowed ? "cursor-pointer hover:bg-slate-100" : isMonthlyHabit ? "cursor-pointer opacity-50 hover:opacity-70" : "cursor-not-allowed opacity-50"
                                } ${
                                  isSelected
                                    ? isCurrentDay
                                      ? "bg-primary/20"
                                      : "bg-brand-blue-soft"
                                    : isCurrentDay
                                      ? "bg-brand-blue-soft brightness-[0.98]"
                                      : "bg-white group-hover:bg-slate-50"
                                }`}
                                style={{
                                  width: "45px",
                                  minWidth: "45px",
                                  height: "45px",
                                  maxHeight: "45px",
                                  verticalAlign: "middle",
                                  paddingTop: "6px",
                                  paddingBottom: "6px",
                                  overflow: "hidden",
                                  lineHeight: "1",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isDayAllowed && isMonthlyHabit) {
                                    handleMonthlyHabitDateChange(habit.id, day);
                                    return;
                                  }
                                  if (!isDayAllowed) return;
                                  handleCheckboxToggle(habit.id, day, !isFull);
                                }}
                                title={
                                  !isDayAllowed
                                    ? isWeeklyHabit
                                      ? "Hari ini tidak dipilih untuk habit ini"
                                      : isMonthlyHabit
                                        ? "Klik untuk mengubah tanggal habit ini"
                                        : "Hari ini tidak dipilih untuk habit ini"
                                    : isMultiEntry && entriesCount > 0
                                      ? `${entriesCount}/${habit.target_count} completed`
                                      : undefined
                                }
                              >
                                <div className="flex flex-col items-center justify-center" style={{ height: "33px", maxHeight: "33px", overflow: "hidden" }}>
                                  {isMultiEntry ? (
                                    <>
                                      <div style={{ height: "8px", flexShrink: 0, minHeight: "8px", maxHeight: "8px" }} />
                                      <div className="flex items-center justify-center flex-shrink-0" style={{ height: "16px", minHeight: "16px", maxHeight: "16px" }}>
                                        <Checkbox
                                          checked={checkboxState}
                                          onCheckedChange={(checked) => {
                                            if (!isDayAllowed && isMonthlyHabit) {
                                              handleMonthlyHabitDateChange(habit.id, day);
                                              return;
                                            }
                                            if (!isDayAllowed) return;
                                            handleCheckboxToggle(habit.id, day, !!checked);
                                          }}
                                          disabled={!isDayAllowed && !isMonthlyHabit}
                                          className={`h-4 w-4 rounded-sm habit-grid-checkbox ${isDayAllowed || (isMonthlyHabit && !isDayAllowed) ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${
                                            checkboxState === true ? "habit-grid-checkbox-checked" : ""
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isDayAllowed && isMonthlyHabit) {
                                              handleMonthlyHabitDateChange(habit.id, day);
                                              return;
                                            }
                                            if (!isDayAllowed) e.preventDefault();
                                          }}
                                        />
                                      </div>
                                      {entriesCount > 0 ? (
                                        <div className="flex items-center justify-center flex-shrink-0" style={{ height: "9px", minHeight: "9px", maxHeight: "9px", marginTop: "0px" }}>
                                          <span className="text-[8px] font-semibold leading-none text-primary">
                                            {entriesCount}/{habit.target_count}
                                          </span>
                                        </div>
                                      ) : (
                                        <div style={{ height: "9px", flexShrink: 0, minHeight: "9px", maxHeight: "9px" }} />
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-center" style={{ height: "100%" }}>
                                      <Checkbox
                                        checked={checkboxState}
                                        onCheckedChange={(checked) => {
                                          if (!isDayAllowed && isMonthlyHabit) {
                                            handleMonthlyHabitDateChange(habit.id, day);
                                            return;
                                          }
                                          if (!isDayAllowed) return;
                                          handleCheckboxToggle(habit.id, day, !!checked);
                                        }}
                                        disabled={!isDayAllowed && !isMonthlyHabit}
                                        className={`h-4 w-4 rounded-sm habit-grid-checkbox ${isDayAllowed || (isMonthlyHabit && !isDayAllowed) ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${
                                          checkboxState === true ? "habit-grid-checkbox-checked" : ""
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isDayAllowed && isMonthlyHabit) {
                                            handleMonthlyHabitDateChange(habit.id, day);
                                            return;
                                          }
                                          if (!isDayAllowed) e.preventDefault();
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          {(() => {
                            const { goal, actual, progress } = getHabitAnalysisForRow(habit);
                            const progressColor = "bg-primary";
                            return (
                              <>
                                <td
                                  className={`relative z-0 border-r border-b border-brand-blue/20 px-2 text-center ${isSelected ? "bg-brand-blue-soft" : "bg-white group-hover:bg-slate-50"}`}
                                  style={{ width: "80px", minWidth: "80px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <Target className="h-3 w-3 text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-900">{goal}</span>
                                  </div>
                                </td>
                                <td
                                  className={`relative z-0 border-r border-b border-brand-blue/20 px-2 text-center ${isSelected ? "bg-brand-blue-soft" : "bg-white group-hover:bg-slate-50"}`}
                                  style={{ width: "80px", minWidth: "80px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}
                                >
                                  <span className={`text-sm font-semibold ${actual >= goal ? "text-primary" : actual >= goal * 0.5 ? "text-primary" : "text-gray-900"}`}>{actual}</span>
                                </td>
                                <td
                                  className={`relative z-0 border-b border-r-0 border-brand-blue/20 px-2 ${isSelected ? "bg-brand-blue-soft" : "bg-white group-hover:bg-slate-50"}`}
                                  style={{ width: "120px", minWidth: "120px", height: "45px", verticalAlign: "middle", paddingTop: "6px", paddingBottom: "6px" }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                      <div className={`${progressColor} h-2 rounded-full transition-all duration-300`} style={{ width: `${Math.min(progress, 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 min-w-[35px] text-right">{Math.round(progress)}%</span>
                                  </div>
                                </td>
                              </>
                            );
                          })()}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex-1" />
            <div className="sticky bottom-0 z-20 flex-shrink-0 border-t border-brand-blue/20 bg-brand-blue-soft">
              <div className="flex flex-col" style={{ minWidth: `calc(250px + ${monthDays.length * 45}px + 280px)` }}>
                <div className="relative isolate flex border-t border-brand-blue/20 py-4">
                  <div className="sticky left-0 z-[45] flex w-[250px] min-w-[250px] flex-shrink-0 flex-col items-center justify-center self-stretch border-r border-brand-blue/20 bg-brand-blue-soft shadow-[2px_0_6px_rgba(0,0,0,0.08)]">
                    <div className="flex flex-col items-center justify-center flex-1 w-full py-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2">{t("habitTracker.consistencyRateHeader", "Consistency Rate")}</div>
                      <div className="text-4xl font-bold text-gray-900 w-full text-center">{Math.round(cumulativeConsistencyRate)}%</div>
                    </div>
                  </div>
                  <div className="relative z-0 min-w-0 flex-1 flex-shrink-0 overflow-hidden" style={{ width: `${monthDays.length * 45}px`, minWidth: `${monthDays.length * 45}px` }}>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={chartData} margin={{ top: 5, right: 22.5, left: 0, bottom: 5 }} barCategoryGap={0}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          stroke="#6b7280"
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          tickMargin={8}
                          type="category"
                          scale="point"
                          padding={{ left: 0.5, right: 0.5 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="#6b7280"
                          width={20}
                          domain={[0, 100]}
                          allowDecimals={false}
                          ticks={[0, 25, 50, 75, 100]}
                          tickFormatter={() => ""}
                          label={{ value: "%", position: "insideTopLeft", style: { fontSize: 10, fill: "#6b7280" } }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "12px" }}
                          formatter={(value: number) => [`${value}%`, t("habitTracker.dailyProgressChart", "Progress Harian")]}
                          labelFormatter={(label) => `Day ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="pct"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={{ fill: "hsl(var(--primary))", stroke: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="relative z-0 flex-shrink-0 border-l border-brand-blue/20 bg-brand-blue-soft" style={{ width: "280px", minWidth: "280px" }} />
                </div>
              </div>
            </div>
        </div>
      </div>

      {showAddModal && <HabitFormModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />}
      {editingHabit && <HabitFormModal isOpen={!!editingHabit} onClose={() => setEditingHabit(null)} habitId={editingHabit} />}
      {targetCountModal && <HabitTargetCountModal isOpen={!!targetCountModal} onClose={() => setTargetCountModal(null)} habitId={targetCountModal.habitId} date={targetCountModal.date} />}

      <AlertDialog open={!!habitToDelete} onOpenChange={(open) => !open && setHabitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Habit
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">Are you sure you want to delete this habit?</div>
                {habitToDelete && <div className="font-semibold text-gray-900 bg-gray-50 p-2 rounded border border-gray-200 text-sm">"{habitToDelete.name}"</div>}
                <div className="text-red-600 font-medium text-sm">This action cannot be undone. This will permanently delete the habit and all its associated entries.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHabitToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (habitToDelete) {
                  try {
                    await deleteHabit(habitToDelete.id);
                    setHabitToDelete(null);
                    toast({ title: "Habit deleted", description: `"${habitToDelete.name}" has been deleted successfully` });
                  } catch {
                    toast({ title: "Error", description: "Failed to delete habit", variant: "destructive" });
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Habit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!monthlyHabitConfirmModal}
        onOpenChange={(open) => {
          if (!open) {
            setMonthlyHabitConfirmModal(null);
            setSelectedOldDate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              {t("habitTracker.monthlyHabit.changeDateTitle", "Ubah Tanggal Habit Bulanan")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {monthlyHabitConfirmModal &&
                  (() => {
                    const habit = filteredHabits.find((h) => h.id === monthlyHabitConfirmModal.habitId);
                    const availableDates = habit?.monthly_dates || [];
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(currentMonth);
                    const monthEntries = entries.filter((e) => {
                      if (!habit || e.habit_id !== habit.id) return false;
                      const entryDate = new Date(e.entry_date);
                      return entryDate >= monthStart && entryDate <= monthEnd;
                    });
                    const checkedDates = monthEntries.map((e) => Number.parseInt(format(new Date(e.entry_date), "d"), 10));
                    const selectableDates = availableDates.filter((dateNum) => {
                      const val = Number(dateNum);
                      return val !== monthlyHabitConfirmModal.newDate && !checkedDates.includes(val);
                    });
                    const formatDateForDisplay = (dayOfMonth: number) => {
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayOfMonth);
                      return format(date, "d MMMM yyyy", { locale: dateLocale });
                    };
                    return (
                      <>
                        <div className="text-sm text-gray-600">
                          {t("habitTracker.monthlyHabit.changeDateQuestion", "Apakah Anda ingin mengubah tanggal habit bulanan ini ke tanggal {date}?", {
                            date: formatDateForDisplay(monthlyHabitConfirmModal.newDate),
                          })}
                        </div>
                        {habit && <div className="font-semibold text-gray-900 bg-gray-50 p-2 rounded border border-gray-200 text-sm">"{habit.name}"</div>}
                        {selectableDates.length > 0 ? (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">{t("habitTracker.monthlyHabit.selectOldDate", "Pilih tanggal yang akan diganti:")}</label>
                            <Select value={selectedOldDate?.toString() || ""} onValueChange={(value) => setSelectedOldDate(Number.parseInt(value, 10))}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t("habitTracker.monthlyHabit.selectOldDatePlaceholder", "Pilih tanggal")} />
                              </SelectTrigger>
                              <SelectContent>
                                {selectableDates.map((dateNum) => {
                                  const val = Number(dateNum);
                                  return (
                                    <SelectItem key={dateNum} value={dateNum.toString()}>
                                      {formatDateForDisplay(val)}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{t("habitTracker.monthlyHabit.noDateToReplace", "Tidak ada tanggal yang bisa diganti")}</div>
                        )}
                        {selectedOldDate && (
                          <div className="rounded border border-primary/20 bg-primary/10 p-2 text-xs text-gray-500">
                            {t("habitTracker.monthlyHabit.dateChangeInfo", "Tanggal {oldDate} akan dinonaktifkan dan diganti dengan tanggal {newDate}", {
                              oldDate: formatDateForDisplay(selectedOldDate),
                              newDate: formatDateForDisplay(monthlyHabitConfirmModal.newDate),
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setMonthlyHabitConfirmModal(null);
                setSelectedOldDate(null);
              }}
            >
              {t("common.cancel", "Batal")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!selectedOldDate}
              onClick={async () => {
                if (!monthlyHabitConfirmModal) return;
                if (!selectedOldDate) {
                  toast({
                    title: t("common.error", "Error"),
                    description: t("habitTracker.monthlyHabit.selectOldDateRequired", "Silakan pilih tanggal yang akan diganti"),
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  const habit = filteredHabits.find((h) => h.id === monthlyHabitConfirmModal.habitId);
                  if (!habit) return;

                  const monthStart = startOfMonth(currentMonth);
                  const monthEnd = endOfMonth(currentMonth);
                  const monthEntries = entries.filter((e) => {
                    if (e.habit_id !== habit.id) return false;
                    const entryDate = new Date(e.entry_date);
                    return entryDate >= monthStart && entryDate <= monthEnd;
                  });
                  const currentMonthlyDates = habit.monthly_dates || [];
                  const newMonthlyDates = currentMonthlyDates
                    .filter((d) => Number(d) !== selectedOldDate)
                    .concat([monthlyHabitConfirmModal.newDate])
                    .sort((a, b) => a - b);

                  await updateHabit(habit.id, { monthly_dates: newMonthlyDates });
                  const newDateStr = format(monthlyHabitConfirmModal.date, "yyyy-MM-dd");
                  const oldDateEntries = monthEntries.filter((e) => Number.parseInt(format(new Date(e.entry_date), "d"), 10) === selectedOldDate);
                  for (const entry of oldDateEntries) await deleteEntry(entry.id);
                  if (oldDateEntries.length > 0) await addEntry(habit.id, newDateStr, 1);

                  const formatDateForToast = (dayOfMonth: number) => {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayOfMonth);
                    return format(date, "d MMMM yyyy", { locale: dateLocale });
                  };

                  setMonthlyHabitConfirmModal(null);
                  setSelectedOldDate(null);
                  toast({
                    title: t("habitTracker.monthlyHabit.dateChanged", "Tanggal diubah"),
                    description: t(
                      "habitTracker.monthlyHabit.dateChangedDescriptionWithOld",
                      "Tanggal habit bulanan telah diubah dari tanggal {oldDate} ke tanggal {newDate}",
                      { oldDate: formatDateForToast(selectedOldDate), newDate: formatDateForToast(monthlyHabitConfirmModal.newDate) },
                    ),
                  });
                } catch {
                  toast({
                    title: t("common.error", "Error"),
                    description: t("habitTracker.monthlyHabit.changeDateError", "Gagal mengubah tanggal habit"),
                    variant: "destructive",
                  });
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary"
            >
              <Edit className="w-4 h-4 mr-2" />
              {t("habitTracker.monthlyHabit.changeDateButton", "Ubah Tanggal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
