import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday } from 'date-fns';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Button } from '@/shared/components/ui/button';
import { ChevronLeft, ChevronRight, Edit, Trash2, PanelLeftClose, PanelLeftOpen, Target } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { HabitFormModal } from '@/features/8-2-HabitTracker/components/HabitFormModal';
import { HabitTargetCountModal } from '@/features/8-2-HabitTracker/components/HabitTargetCountModal';
import { MonthlyHabitDateChangeModal, type MonthlyHabitDateChangeModalData } from '@/mobile/1-habits/components/MonthlyHabitDateChangeModal';
import {
  isHabitActiveOnDay,
  isHabitCompletedOnDay,
  canToggleHabitCheckboxOnDay,
  canMonthlyHabitRescheduleOnDay,
  isFutureDayBlockedUntilTodayComplete,
} from '@/features/8-2-HabitTracker/utils/habitDayUtils';
import { getHabitAnalysis, getTotalMonthlyGoal } from '@/features/8-2-HabitTracker/utils/habitAnalysisUtils';
import { useToast } from '@/shared/components/ui/use-toast';

/** Selaras `HabitSpreadsheetView` (desktop). */
const CELL_SIZE = 45;
const GOAL_WIDTH = 80;
const ACTUAL_WIDTH = 80;
const PROGRESS_WIDTH = 120;
const NAME_WIDTH_EXPANDED = 160;
const NAME_WIDTH_COLLAPSED = 48;
const ACTIONS_WIDTH = 56;
const ROW_HEIGHT = 45;
const CHART_ROW_HEIGHT = 150;
const CHART_PLOT_HEIGHT = 110;
const CHART_PADDING_TOP = 12;

const CHART_GRID_TICKS = [0, 25, 50, 75, 100] as const;

function chartPlotY(pct: number) {
  return CHART_PADDING_TOP + CHART_PLOT_HEIGHT - (pct / 100) * CHART_PLOT_HEIGHT;
}

function chartPointCoords(index: number, pct: number) {
  const x = CELL_SIZE / 2 + index * CELL_SIZE;
  return { x, y: chartPlotY(pct) };
}

type HabitGridMobileProps = {
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
};

export const HabitGridMobile = ({ currentMonth: currentMonthProp, onMonthChange }: HabitGridMobileProps) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const { toast } = useToast();
  const {
    filteredHabits,
    entries,
    addEntry,
    deleteEntry,
    deleteHabit,
  } = useHabitTracker();

  const [internalMonth, setInternalMonth] = useState(new Date());
  const currentMonth = currentMonthProp ?? internalMonth;
  const setCurrentMonth = onMonthChange ?? setInternalMonth;

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<{ id: string; name: string } | null>(null);
  const [targetCountModal, setTargetCountModal] = useState<{ habitId: string; date: Date } | null>(null);
  const [monthlyHabitConfirmModal, setMonthlyHabitConfirmModal] = useState<MonthlyHabitDateChangeModalData | null>(null);
  const [selectedOldDate, setSelectedOldDate] = useState<number | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [swipeState, setSwipeState] = useState<{ habitId: string; startX: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isHabitColumnExpanded, setIsHabitColumnExpanded] = useState(true);

  const swipeStartXRef = React.useRef<number>(0);
  const swipeStartYRef = React.useRef<number>(0);
  const swipeHabitIdRef = React.useRef<string | null>(null);
  const expandedHabitIdRef = React.useRef<string | null>(null);
  const setDragOffsetRef = React.useRef(setDragOffset);
  const setSwipeStateRef = React.useRef(setSwipeState);
  setDragOffsetRef.current = setDragOffset;
  setSwipeStateRef.current = setSwipeState;
  expandedHabitIdRef.current = expandedHabitId;
  const nameColumnWidth = isHabitColumnExpanded ? NAME_WIDTH_EXPANDED : NAME_WIDTH_COLLAPSED;

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEntryForDate = useCallback((habitId: string, date: Date) => {
    const d = format(date, 'yyyy-MM-dd');
    return entries.find((e) => e.habit_id === habitId && e.entry_date === d);
  }, [entries]);

  const getEntriesCountForDate = useCallback((habitId: string, date: Date) => {
    const d = format(date, 'yyyy-MM-dd');
    return entries.filter((e) => e.habit_id === habitId && e.entry_date === d).length;
  }, [entries]);

  const chartData = useMemo(() => {
    return monthDays.map((day) => {
      const activeHabits = filteredHabits.filter((h) => isHabitActiveOnDay(h, day));
      const total = activeHabits.length;
      const done = activeHabits.filter((h) => isHabitCompletedOnDay(h, day, entries)).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { date: format(day, 'd'), dayName: format(day, 'EEE'), done, total, pct };
    });
  }, [monthDays, filteredHabits, entries]);

  const chartSvg = useMemo(() => {
    const points = chartData.map((row, idx) => chartPointCoords(idx, row.pct));
    return {
      points,
      polyline: points.map((p) => `${p.x},${p.y}`).join(' '),
      width: monthDays.length * CELL_SIZE,
    };
  }, [chartData, monthDays.length]);

  const gridMinWidth =
    nameColumnWidth + monthDays.length * CELL_SIZE + GOAL_WIDTH + ACTUAL_WIDTH + PROGRESS_WIDTH;

  const handleCheckboxToggle = useCallback(async (habitId: string, date: Date, checked: boolean) => {
    const habit = filteredHabits.find((h) => h.id === habitId);
    if (!habit) return;

    if (!canToggleHabitCheckboxOnDay(habit, date, entries)) return;

    if (habit.frequency === 'daily' && habit.target_count && habit.target_count > 1) {
      setTargetCountModal({ habitId, date });
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const existingEntry = getEntryForDate(habitId, date);

    try {
      if (checked && !existingEntry) {
        await addEntry(habitId, dateStr, 1);
      } else if (!checked && existingEntry) {
        await deleteEntry(existingEntry.id);
      }
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.updateFailed', 'Gagal memperbarui'),
        variant: 'destructive',
      });
    }
  }, [filteredHabits, entries, addEntry, deleteEntry, getEntryForDate, toast, t]);

  const handleDeleteHabit = useCallback(async () => {
    if (!habitToDelete) return;
    try {
      await deleteHabit(habitToDelete.id);
      toast({ title: t('habitTracker.habitDeleted', 'Habit dihapus'), variant: 'default' });
      setHabitToDelete(null);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.deleteFailed', 'Gagal menghapus habit'),
        variant: 'destructive',
      });
    }
  }, [habitToDelete, deleteHabit, toast, t]);

  // Same as desktop: open "Ubah Tanggal Habit Bulanan" when clicking a disabled monthly-habit day
  const handleMonthlyHabitDateChange = useCallback(
    (habitId: string, date: Date) => {
      const habit = filteredHabits.find((h) => h.id === habitId);
      if (!habit || habit.frequency !== 'monthly') return;

      const dayOfMonth = parseInt(format(date, 'd'));
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const monthEntries = entries.filter((e) => {
        if (e.habit_id !== habit.id) return false;
        const entryDate = new Date(e.entry_date);
        return entryDate >= monthStart && entryDate <= monthEnd;
      });
      const currentEntriesCount = monthEntries.length;

      if (habit.target_count != null && currentEntriesCount >= habit.target_count) {
        toast({
          title: t('habitTracker.monthlyHabit.limitReached', 'Limit Tercapai'),
          description: t('habitTracker.monthlyHabit.limitReachedDescription', 'Anda sudah menyelesaikan {count} entry bulan ini. Silakan hapus entry yang ada terlebih dahulu.', {
            count: String(habit.target_count),
          }),
          variant: 'destructive',
        });
        return;
      }

      let defaultOldDate: number | null = null;
      if (habit.monthly_dates && habit.monthly_dates.length > 0) {
        const checkedDates = monthEntries.map((e) => {
          const entryDate = new Date(e.entry_date);
          return parseInt(format(entryDate, 'd'));
        });
        const availableOldDate = habit.monthly_dates.find((d: number) => {
          const dateNum = Number(d);
          return dateNum !== dayOfMonth && !checkedDates.includes(dateNum);
        });
        if (availableOldDate) defaultOldDate = Number(availableOldDate);
      }

      setSelectedOldDate(defaultOldDate);
      setMonthlyHabitConfirmModal({
        habitId,
        date,
        newDate: dayOfMonth,
        oldDate: defaultOldDate,
      });
    },
    [currentMonth, entries, filteredHabits, toast, t]
  );

  const goToPreviousMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const getSwipeTranslateX = useCallback(
    (habitId: string) => {
      const base = expandedHabitId === habitId ? -ACTIONS_WIDTH : 0;
      const isDraggingThis = swipeState?.habitId === habitId;
      return base + (isDraggingThis ? dragOffset : 0);
    },
    [expandedHabitId, swipeState?.habitId, dragOffset]
  );

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent, habitId: string) => {
    if ((e.target as HTMLElement).closest('[data-habit-name-scroll]')) return;
    const startX = e.targetTouches[0].clientX;
    const startY = e.targetTouches[0].clientY;
    setDragOffset(0);
    swipeStartXRef.current = startX;
    swipeStartYRef.current = startY;
    swipeHabitIdRef.current = habitId;
  }, []);

  const handleSwipeTouchMove = useCallback(
    (_e: React.TouchEvent, habitId: string) => {
      if (!swipeState || swipeState.habitId !== habitId) return;
      // Actual move handling & preventDefault done in document touchmove (passive: false) for reliable touch on mobile
    },
    [swipeState]
  );

  const handleSwipeTouchEnd = useCallback(
    (habitId: string) => {
      if (swipeHabitIdRef.current !== habitId) return;
      swipeHabitIdRef.current = null;
      if (!swipeState || swipeState.habitId !== habitId || dragOffset === 0) {
        setSwipeState(null);
        setDragOffset(0);
        return;
      }
      const threshold = 12;
      const base = expandedHabitId === habitId ? -ACTIONS_WIDTH : 0;
      const finalX = base + dragOffset;
      if (expandedHabitId === habitId) {
        if (finalX > -ACTIONS_WIDTH + threshold) setExpandedHabitId(null);
      } else {
        if (finalX < -threshold) setExpandedHabitId(habitId);
      }
      setSwipeState(null);
      setDragOffset(0);
    },
    [swipeState, expandedHabitId, dragOffset]
  );

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      const habitId = swipeHabitIdRef.current;
      if (!habitId || !e.target) return;
      const row = (e.target as HTMLElement).closest('[data-habit-swipe-row]');
      if (!row || (row as HTMLElement).getAttribute('data-habit-swipe-row') !== habitId) return;
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const deltaX = clientX - swipeStartXRef.current;
      const deltaY = clientY - swipeStartYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      // Geser horizontal grid: jangan tangkap sebagai swipe reveal kolom habit
      if (absX > 28 && absX > absY * 1.35) {
        swipeHabitIdRef.current = null;
        setSwipeStateRef.current(null);
        setDragOffsetRef.current(0);
        return;
      }
      if (absY > absX * 1.15) {
        swipeHabitIdRef.current = null;
        setSwipeStateRef.current(null);
        setDragOffsetRef.current(0);
        return;
      }
      const base = expandedHabitIdRef.current === habitId ? -ACTIONS_WIDTH : 0;
      const maxRight = -base;
      const maxLeft = -ACTIONS_WIDTH - base;
      const clamped = Math.max(maxLeft, Math.min(maxRight, deltaX));
      if (absX > 6 && absX >= absY) {
        e.preventDefault();
        setSwipeStateRef.current({ habitId, startX: swipeStartXRef.current });
        setDragOffsetRef.current(clamped);
      }
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    return () => document.removeEventListener('touchmove', onTouchMove, { capture: true });
  }, []);

  const handleToggleSwipeReveal = useCallback((habitId: string) => {
    setExpandedHabitId((prev) => (prev === habitId ? null : habitId));
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
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
    return () => document.head.removeChild(style);
  }, []);

  if (filteredHabits.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-brand-blue/20 bg-white p-4 shadow-sm ring-1 ring-brand-blue/10">
        <p className="text-center text-sm text-gray-500">
          {t('habitTracker.noHabitsToday', 'Tidak ada habit. Tambah habit untuk memulai.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm ring-1 ring-brand-blue/10">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-blue/20 bg-brand-blue/[0.06] px-3 py-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 p-0 hover:bg-brand-blue/10" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: dateFnsLocale })}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 p-0 hover:bg-brand-blue/10" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Satu scroll container (x+y): sticky header + geser jari kiri/kanan (selaras PaymentTable mobile) */}
        <div
          className="scrollbar-hide seamless-scroll nested-scroll-touch-chain-xy relative flex min-h-0 min-w-0 max-h-[calc(100vh-340px)] flex-1 touch-pan-x touch-pan-y flex-col overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
          role="region"
          aria-label={t('habitTracker.habitGrid', 'Daftar habit bulanan')}
        >
          <div className="flex w-max min-w-full flex-col" style={{ width: gridMinWidth, minWidth: gridMinWidth }}>
            <table
              className="border-separate border-spacing-0 bg-white"
              style={{ width: gridMinWidth, minWidth: gridMinWidth, tableLayout: 'fixed' }}
            >
            <thead
              className="sticky top-0 z-[25] border-b border-brand-blue/20 bg-brand-blue-soft"
              style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
            >
              <tr style={{ height: ROW_HEIGHT }}>
                <th
                  className="sticky left-0 z-[50] border-b border-r border-brand-blue/20 bg-brand-blue-soft px-2 text-left text-sm font-semibold text-gray-700 shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
                  style={{ width: nameColumnWidth, minWidth: nameColumnWidth, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  <div className="flex items-center gap-1 px-2 py-2 min-w-0">
                    {isHabitColumnExpanded ? (
                      <>
                        <span className="truncate flex-1 min-w-0">{t('habitTracker.habitName', 'Habit')}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => setIsHabitColumnExpanded(false)}
                          aria-label={t('habitTracker.collapseColumn', 'Sempitkan kolom')}
                        >
                          <PanelLeftClose className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => setIsHabitColumnExpanded(true)}
                        aria-label={t('habitTracker.expandColumn', 'Lebarkan kolom')}
                      >
                        <PanelLeftOpen className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </th>
                {monthDays.map((day) => {
                  const isCurrentDay = isToday(day);
                  return (
                    <th
                      key={day.toISOString()}
                      className={`relative z-0 border-b border-r border-brand-blue/20 px-1 text-center text-xs font-medium text-gray-700 ${
                        isCurrentDay ? 'bg-brand-blue-soft brightness-[0.97]' : 'bg-brand-blue-soft'
                      }`}
                      style={{ width: CELL_SIZE, minWidth: CELL_SIZE, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] uppercase text-gray-500">{format(day, 'EEE')}</span>
                        <span className={`text-sm font-semibold ${isCurrentDay ? 'text-primary' : 'text-gray-900'}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th
                  className="relative z-0 border-b border-r border-gray-300 bg-gray-100 px-3 text-center text-xs font-semibold text-gray-700"
                  style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  {t('habitTracker.goal', 'Goal')}
                </th>
                <th
                  className="relative z-0 border-b border-r border-gray-300 bg-gray-100 px-3 text-center text-xs font-semibold text-gray-700"
                  style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  {t('habitTracker.actual', 'Actual')}
                </th>
                <th
                  className="relative z-0 border-b border-gray-300 bg-gray-100 px-3 text-center text-xs font-semibold text-gray-700"
                  style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  {t('habitTracker.progress', 'Progress')}
                </th>
              </tr>
              <tr className="border-y border-brand-blue/20 bg-brand-blue-soft" style={{ height: ROW_HEIGHT }}>
                <td
                  className="sticky left-0 z-[40] border-b border-r border-brand-blue/20 bg-brand-blue-soft px-2 text-xs font-semibold text-gray-700 shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
                  style={{ width: nameColumnWidth, minWidth: nameColumnWidth, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  {isHabitColumnExpanded ? t('habitTracker.dailyStats', 'Daily Stats') : ''}
                </td>
                {chartData.map((row, idx) => {
                  const day = monthDays[idx];
                  const isCurrentDay = isToday(day);
                  const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
                  const isComplete = pct === 100;
                  return (
                    <td
                      key={`stats-${day.toISOString()}`}
                      className={`relative z-0 border-b border-r border-brand-blue/20 px-1 text-center ${
                        isCurrentDay ? 'bg-brand-blue-soft brightness-[0.97]' : 'bg-brand-blue-soft'
                      }`}
                      style={{ width: CELL_SIZE, minWidth: CELL_SIZE, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                    >
                      <span
                        className={`text-[10px] font-bold ${
                          isComplete ? 'rounded bg-primary px-1.5 py-0.5 text-primary-foreground' : 'text-gray-700'
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                  );
                })}
                <td
                  className="relative z-0 border-b border-r border-gray-300 bg-gray-50 px-2 text-center"
                  style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Target className="h-3 w-3 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-900">
                      {getTotalMonthlyGoal(filteredHabits, monthDays)}
                    </span>
                  </div>
                </td>
                <td
                  className="relative z-0 border-b border-r border-gray-300 bg-gray-50 px-2 text-center"
                  style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  {(() => {
                    const totalGoal = getTotalMonthlyGoal(filteredHabits, monthDays);
                    const totalActual = chartData.reduce(
                      (sum, _row, idx) =>
                        sum +
                        entries.filter((e) => e.entry_date === format(monthDays[idx], 'yyyy-MM-dd')).length,
                      0
                    );
                    return (
                      <span
                        className={`text-xs font-semibold ${
                          totalActual >= totalGoal
                            ? 'text-primary'
                            : totalActual >= totalGoal * 0.5
                              ? 'text-primary'
                              : 'text-gray-900'
                        }`}
                      >
                        {totalActual}
                      </span>
                    );
                  })()}
                </td>
                <td
                  className="relative z-0 border-b border-gray-300 bg-gray-50 px-2"
                  style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                >
                  {(() => {
                    const totalGoal = getTotalMonthlyGoal(filteredHabits, monthDays);
                    const totalActual = chartData.reduce(
                      (sum, _row, idx) =>
                        sum +
                        entries.filter((e) => e.entry_date === format(monthDays[idx], 'yyyy-MM-dd')).length,
                      0
                    );
                    const totalProgress = totalGoal > 0 ? Math.min((totalActual / totalGoal) * 100, 100) : 0;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(totalProgress, 100)}%` }}
                          />
                        </div>
                        <span className="min-w-[30px] text-right text-[10px] font-medium text-gray-700">
                          {Math.round(totalProgress)}%
                        </span>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredHabits.map((habit) => (
                <tr key={habit.id} className="group transition-colors" style={{ height: ROW_HEIGHT }}>
                  <td
                    className="sticky left-0 z-[15] border-b border-r border-gray-300 bg-white p-0 shadow-[2px_0_4px_rgba(0,0,0,0.08)] group-hover:bg-slate-50"
                    style={{ width: nameColumnWidth, minWidth: nameColumnWidth, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                  >
                    <div
                      className="overflow-hidden touch-manipulation"
                      style={{ width: nameColumnWidth }}
                      data-habit-swipe-row={habit.id}
                      onTouchStart={(e) => handleSwipeTouchStart(e, habit.id)}
                      onTouchMove={(e) => handleSwipeTouchMove(e, habit.id)}
                      onTouchEnd={() => handleSwipeTouchEnd(habit.id)}
                    >
                      <div
                        className="flex items-stretch transition-transform duration-150 ease-out"
                        style={{
                          width: nameColumnWidth + ACTIONS_WIDTH,
                          transform: `translateX(${getSwipeTranslateX(habit.id)}px)`,
                        }}
                      >
                        <div
                          className={`flex items-center gap-2 min-w-0 flex-shrink-0 py-1.5 pl-2 pr-0 ${!isHabitColumnExpanded ? 'justify-center' : ''}`}
                          style={{ width: nameColumnWidth }}
                        >
                          {isHabitColumnExpanded ? (
                            <>
                              <div
                                className="h-3 w-3 flex-shrink-0 rounded-full border border-gray-300"
                                style={{ backgroundColor: habit.color || '#3b82f6' }}
                              />
                              <div
                                data-habit-name-scroll
                                className="scrollbar-hide min-w-0 flex-1 overflow-x-auto overflow-y-hidden seamless-scroll touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                              >
                                <span className="inline-block truncate whitespace-nowrap text-sm font-medium text-gray-900">
                                  {habit.name}
                                </span>
                              </div>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="ml-auto flex-shrink-0 rounded p-0.5 text-gray-500 transition-colors touch-manipulation hover:bg-gray-200 hover:text-gray-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSwipeReveal(habit.id);
                            }}
                            aria-label={expandedHabitId === habit.id ? t('habitTracker.closeActions', 'Tutup aksi') : t('habitTracker.revealActions', 'Tampilkan edit & hapus')}
                          >
                            <ChevronRight
                              className={`h-3 w-3 transition-transform duration-200 ${expandedHabitId === habit.id ? 'rotate-90' : ''}`}
                            />
                          </button>
                        </div>
                        <div
                          className="flex flex-shrink-0 items-center border-l border-gray-300 bg-gray-100 pr-2"
                          style={{ width: ACTIONS_WIDTH }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none hover:bg-gray-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedHabitId(null);
                              setEditingHabitId(habit.id);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedHabitId(null);
                              setHabitToDelete({ id: habit.id, name: habit.name });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </td>
                  {monthDays.map((day) => {
                    const entriesCount = getEntriesCountForDate(habit.id, day);
                    const isCurrentDay = isToday(day);
                    const isMulti = habit.frequency === 'daily' && habit.target_count && habit.target_count > 1;
                    const isFull = entriesCount >= (habit.target_count ?? 1);
                    const isPartial = entriesCount > 0 && !isFull;

                    const isDayAllowed = canToggleHabitCheckboxOnDay(habit, day, entries);
                    const canMonthlyReschedule = canMonthlyHabitRescheduleOnDay(habit, day, entries);
                    const isFutureBlocked = isFutureDayBlockedUntilTodayComplete(habit, day, entries);

                    const checkboxChecked = isMulti ? isFull : entriesCount > 0;
                    const checkboxState: boolean | 'indeterminate' = isMulti && isPartial ? 'indeterminate' : checkboxChecked;

                    return (
                      <td
                        key={`${habit.id}-${day.toISOString()}`}
                        className={`relative z-0 border-b border-r border-brand-blue/20 px-1 text-center transition-colors ${
                          isDayAllowed
                            ? 'cursor-pointer hover:bg-slate-100'
                            : canMonthlyReschedule
                              ? 'cursor-pointer opacity-50 hover:opacity-70'
                              : 'cursor-not-allowed opacity-50'
                        } ${
                          isCurrentDay ? 'bg-brand-blue-soft brightness-[0.98]' : 'bg-white group-hover:bg-slate-50'
                        }`}
                        style={{
                          width: CELL_SIZE,
                          minWidth: CELL_SIZE,
                          height: ROW_HEIGHT,
                          maxHeight: ROW_HEIGHT,
                          verticalAlign: 'middle',
                        }}
                        title={
                          isFutureBlocked
                            ? t(
                                'habitTracker.completeTodayFirst',
                                'Selesaikan habit hari ini terlebih dahulu',
                              )
                            : undefined
                        }
                        onClick={() => {
                          if (canMonthlyReschedule) {
                            handleMonthlyHabitDateChange(habit.id, day);
                            return;
                          }
                          if (!isDayAllowed) return;
                          if (isMulti) {
                            handleCheckboxToggle(habit.id, day, !isFull);
                          }
                        }}
                        onTouchEnd={(e) => {
                          if (canMonthlyReschedule) {
                            e.preventDefault();
                            handleMonthlyHabitDateChange(habit.id, day);
                          }
                        }}
                        role="button"
                        tabIndex={canMonthlyReschedule ? 0 : undefined}
                        onKeyDown={
                          canMonthlyReschedule
                            ? (ev) => {
                                if (ev.key === 'Enter' || ev.key === ' ') {
                                  ev.preventDefault();
                                  handleMonthlyHabitDateChange(habit.id, day);
                                }
                              }
                            : undefined
                        }
                      >
                        <div className="flex flex-col items-center justify-center py-0.5">
                          <Checkbox
                            checked={checkboxState}
                            onCheckedChange={(c) => {
                              if (canMonthlyReschedule) {
                                handleMonthlyHabitDateChange(habit.id, day);
                                return;
                              }
                              if (!isDayAllowed) return;
                              handleCheckboxToggle(habit.id, day, !!c);
                            }}
                            disabled={!isDayAllowed && !canMonthlyReschedule}
                            className={`habit-grid-checkbox h-4 w-4 rounded-sm ${
                              isDayAllowed || canMonthlyReschedule
                                ? 'cursor-pointer'
                                : 'cursor-not-allowed opacity-50'
                            } ${checkboxState === true ? 'habit-grid-checkbox-checked' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {isMulti && entriesCount > 0 && (
                            <span className="text-[8px] font-semibold leading-none text-primary">
                              {entriesCount}/{habit.target_count}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {/* Goal, Actual, Progress - same logic as desktop (shared getHabitAnalysis) */}
                  {(() => {
                    const { goal, actual, progress } = getHabitAnalysis(habit, monthDays, entries);
                    return (
                      <>
                        <td
                          className="relative z-0 border-b border-r border-brand-blue/20 bg-white px-2 text-center group-hover:bg-slate-50"
                          style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <Target className="h-3 w-3 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-900">{goal}</span>
                          </div>
                        </td>
                        <td
                          className="relative z-0 border-b border-r border-brand-blue/20 bg-white px-2 text-center group-hover:bg-slate-50"
                          style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                        >
                          <span
                            className={`text-sm font-semibold ${
                              actual >= goal ? 'text-primary' : actual >= goal * 0.5 ? 'text-primary' : 'text-gray-900'
                            }`}
                          >
                            {actual}
                          </span>
                        </td>
                        <td
                          className="relative z-0 border-b border-brand-blue/20 bg-white px-2 group-hover:bg-slate-50"
                          style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH, height: ROW_HEIGHT, verticalAlign: 'middle' }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <span className="min-w-[35px] text-right text-xs font-medium text-gray-700">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>

            {/* Progress Harian: sticky bawah (selaras HabitSpreadsheetView desktop) */}
            <div
              className="sticky bottom-0 z-20 flex-shrink-0 border-t border-brand-blue/20 bg-brand-blue-soft"
              style={{ boxShadow: '0 -2px 4px rgba(0, 0, 0, 0.1)' }}
            >
              <div className="flex" style={{ minWidth: gridMinWidth, height: CHART_ROW_HEIGHT }}>
                <div
                  className="sticky left-0 z-[45] flex flex-shrink-0 items-center justify-center self-stretch border-r border-brand-blue/20 bg-brand-blue-soft px-2 text-center shadow-[2px_0_4px_rgba(0,0,0,0.08)]"
                  style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}
                >
                  <span
                    className={
                      isHabitColumnExpanded
                        ? 'text-sm font-semibold text-gray-700'
                        : 'sr-only'
                    }
                  >
                    {t('habitTracker.dailyProgressChart', 'Progress Harian')}
                  </span>
                </div>
                <div
                  className="relative flex-shrink-0 border-b border-brand-blue/20 bg-brand-blue-soft"
                  style={{ width: chartSvg.width, minWidth: chartSvg.width, height: CHART_ROW_HEIGHT }}
                  role="img"
                  aria-label={t('habitTracker.dailyProgressChart', 'Progress Harian')}
                >
                  <span className="pointer-events-none absolute left-1 top-1 z-10 text-[10px] font-medium text-gray-500">
                    %
                  </span>
                  {/* Grid horizontal (di belakang garis chart) — border CSS agar terlihat di layar mobile */}
                  <div
                    className="pointer-events-none absolute left-0 z-0"
                    style={{
                      top: CHART_PADDING_TOP,
                      width: chartSvg.width,
                      height: CHART_PLOT_HEIGHT,
                    }}
                    aria-hidden
                  >
                    {CHART_GRID_TICKS.map((tick) => (
                      <div
                        key={tick}
                        className="absolute left-0 right-0 border-t border-gray-300"
                        style={{ top: (CHART_PLOT_HEIGHT * (100 - tick)) / 100 }}
                      />
                    ))}
                  </div>
                  <svg
                    width={chartSvg.width}
                    height={CHART_ROW_HEIGHT - 8}
                    className="relative z-[1] block overflow-visible"
                    aria-hidden
                  >
                    <polyline
                      points={chartSvg.polyline}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {chartSvg.points.map((p, idx) => (
                      <circle
                        key={monthDays[idx]?.toISOString() ?? idx}
                        cx={p.x}
                        cy={p.y}
                        r={3}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      >
                        <title>
                          {t('habitTracker.day', 'Hari')} {chartData[idx]?.date}: {chartData[idx]?.pct}%
                        </title>
                      </circle>
                    ))}
                  </svg>
                </div>
                <div
                  className="flex-shrink-0 border-b border-r border-brand-blue/20 bg-brand-blue-soft"
                  style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH }}
                />
                <div
                  className="flex-shrink-0 border-b border-r border-brand-blue/20 bg-brand-blue-soft"
                  style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH }}
                />
                <div
                  className="flex-shrink-0 border-b border-brand-blue/20 bg-brand-blue-soft"
                  style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!habitToDelete} onOpenChange={(open) => !open && setHabitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('habitTracker.deleteHabitTitle', 'Hapus habit?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {habitToDelete &&
                t('habitTracker.deleteHabitDescription', 'Habit "{{name}}" dan semua entri akan dihapus. Tindakan ini tidak dapat dibatalkan.', {
                  name: habitToDelete.name,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Batal')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHabit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete', 'Hapus')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HabitFormModal
        isOpen={!!editingHabitId}
        onClose={() => setEditingHabitId(null)}
        habitId={editingHabitId ?? undefined}
      />

      {targetCountModal && (
        <HabitTargetCountModal
          isOpen={true}
          onClose={() => setTargetCountModal(null)}
          habitId={targetCountModal.habitId}
          date={targetCountModal.date}
        />
      )}

      <MonthlyHabitDateChangeModal
        open={!!monthlyHabitConfirmModal}
        onClose={() => {
          setMonthlyHabitConfirmModal(null);
          setSelectedOldDate(null);
        }}
        data={monthlyHabitConfirmModal}
        currentMonth={currentMonth}
        selectedOldDate={selectedOldDate}
        onSelectedOldDateChange={setSelectedOldDate}
      />
    </>
  );
};
