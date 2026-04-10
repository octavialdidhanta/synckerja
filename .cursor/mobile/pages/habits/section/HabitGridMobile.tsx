import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday } from 'date-fns';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { Checkbox } from '@/features/ui/checkbox';
import { Button } from '@/features/ui/button';
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
} from '@/features/ui/alert-dialog';
import { HabitFormModal } from '@/features/8-2-HabitTracker/components/HabitFormModal';
import { HabitTargetCountModal } from '@/features/8-2-HabitTracker/components/HabitTargetCountModal';
import { MonthlyHabitDateChangeModal, type MonthlyHabitDateChangeModalData } from '@/mobile/pages/habits/components/MonthlyHabitDateChangeModal';
import { isHabitActiveOnDay, isHabitCompletedOnDay } from '@/features/8-2-HabitTracker/utils/habitDayUtils';
import { getHabitAnalysis, getTotalMonthlyGoal } from '@/features/8-2-HabitTracker/utils/habitAnalysisUtils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useToast } from '@/features/ui/use-toast';

const CELL_SIZE = 40;
const GOAL_WIDTH = 52;
const ACTUAL_WIDTH = 52;
const PROGRESS_WIDTH = 88;
const NAME_WIDTH_EXPANDED = 160;
const NAME_WIDTH_COLLAPSED = 48;
const ACTIONS_WIDTH = 56; // edit + delete buttons revealed on swipe

type HabitGridMobileProps = {
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
};

export const HabitGridMobile = ({ currentMonth: currentMonthProp, onMonthChange }: HabitGridMobileProps) => {
  const { t, dateLocale } = useAppTranslation();
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
  setDragOffsetRef.current = setDragOffset;
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

  const handleCheckboxToggle = useCallback(async (habitId: string, date: Date, checked: boolean) => {
    const habit = filteredHabits.find((h) => h.id === habitId);
    if (!habit) return;

    if (habit.frequency === 'daily' && habit.target_count && habit.target_count > 1) {
      setTargetCountModal({ habitId, date });
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const existingEntry = getEntryForDate(habitId, date);

    try {
      if (checked && !existingEntry) {
        await addEntry(habitId, dateStr, 1);
        toast({ title: t('habitTracker.entryLogged', 'Entry dicatat'), variant: 'default' });
      } else if (!checked && existingEntry) {
        await deleteEntry(existingEntry.id);
        toast({ title: t('habitTracker.entryRemoved', 'Entry dihapus'), variant: 'default' });
      }
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.updateFailed', 'Gagal memperbarui'),
        variant: 'destructive',
      });
    }
  }, [filteredHabits, addEntry, deleteEntry, getEntryForDate, toast, t]);

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
    setSwipeState({ habitId, startX });
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
      if (!swipeState || swipeState.habitId !== habitId) return;
      swipeHabitIdRef.current = null;
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
      const base = expandedHabitIdRef.current === habitId ? -ACTIONS_WIDTH : 0;
      const maxRight = -base;
      const maxLeft = -ACTIONS_WIDTH - base;
      const clamped = Math.max(maxLeft, Math.min(maxRight, deltaX));
      if (absX > 4 && absX >= absY) {
        e.preventDefault();
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
      .checkbox-full-green[data-state="checked"] {
        background-color: #16a34a !important;
        border-color: #16a34a !important;
      }
      .checkbox-full-green[data-state="checked"] svg {
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  if (filteredHabits.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground text-center">
          {t('habitTracker.noHabitsToday', 'Tidak ada habit. Tambah habit untuk memulai.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Grid + chart: vertical scroll (scroll-chaining.mdc §3.1) lalu horizontal scroll untuk tabel */}
        <div
          className="overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain max-h-[calc(100vh-340px)] min-h-0"
          role="region"
          aria-label={t('habitTracker.habitGrid', 'Daftar habit bulanan')}
        >
          <div className="overflow-x-auto overflow-y-visible seamless-scroll touch-pan-x min-h-0">
          <div style={{ minWidth: nameColumnWidth + monthDays.length * CELL_SIZE + GOAL_WIDTH + ACTUAL_WIDTH + PROGRESS_WIDTH }}>
            <table className="border-collapse" style={{ minWidth: nameColumnWidth + monthDays.length * CELL_SIZE + GOAL_WIDTH + ACTUAL_WIDTH + PROGRESS_WIDTH }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 border-r border-border text-left text-xs font-semibold text-foreground bg-muted shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                  style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}
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
                      className={`border-r border-border px-0.5 py-1 text-center text-[10px] font-medium ${
                        isCurrentDay ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                      }`}
                      style={{ width: CELL_SIZE, minWidth: CELL_SIZE }}
                    >
                      <div className="flex flex-col">
                        <span>{format(day, 'EEE')}</span>
                        <span className="font-semibold">{format(day, 'd')}</span>
                      </div>
                    </th>
                  );
                })}
                <th
                  className="border-r border-border px-1 py-1 text-center text-[10px] font-semibold text-muted-foreground bg-muted/50"
                  style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH }}
                >
                  {t('habitTracker.goal', 'Goal')}
                </th>
                <th
                  className="border-r border-border px-1 py-1 text-center text-[10px] font-semibold text-muted-foreground bg-muted/50"
                  style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH }}
                >
                  {t('habitTracker.actual', 'Actual')}
                </th>
                <th
                  className="border-r border-border px-1 py-1 text-center text-[10px] font-semibold text-muted-foreground bg-muted/50"
                  style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH }}
                >
                  {t('habitTracker.progress', 'Progress')}
                </th>
              </tr>
              {/* Daily Stats row */}
              <tr className="bg-muted/30 border-b border-border">
                <td
                  className="sticky left-0 z-20 border-r border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                  style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}
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
                      className={`border-r border-border px-0.5 py-1 text-center ${isCurrentDay ? 'bg-primary/10' : ''}`}
                      style={{ width: CELL_SIZE, minWidth: CELL_SIZE }}
                    >
                      <span
                        className={`text-[10px] font-bold ${
                          isComplete ? 'bg-green-600 text-white px-1 py-0.5 rounded' : 'text-muted-foreground'
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                  );
                })}
                <td
                  className="border-r border-border px-1 py-1 text-center bg-muted/30"
                  style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH }}
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-foreground">
                      {getTotalMonthlyGoal(filteredHabits, monthDays)}
                    </span>
                  </div>
                </td>
                <td
                  className="border-r border-border px-1 py-1 text-center bg-muted/30"
                  style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH }}
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
                        className={`text-[10px] font-semibold ${
                          totalActual >= totalGoal
                            ? 'text-green-600'
                            : totalActual >= totalGoal * 0.5
                              ? 'text-blue-600'
                              : 'text-foreground'
                        }`}
                      >
                        {totalActual}
                      </span>
                    );
                  })()}
                </td>
                <td
                  className="border-r border-border px-1 py-1 bg-muted/30"
                  style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH }}
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
                    const progressColor =
                      totalProgress >= 100 ? 'bg-green-500' : totalProgress >= 50 ? 'bg-blue-500' : 'bg-yellow-500';
                    return (
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden min-w-0">
                          <div
                            className={`${progressColor} h-1.5 rounded-full transition-all duration-300`}
                            style={{ width: `${Math.min(totalProgress, 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-medium text-muted-foreground shrink-0">
                          {Math.round(totalProgress)}%
                        </span>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            </thead>
            <tbody>
              {filteredHabits.map((habit) => (
                <tr key={habit.id} className="border-b border-border">
                  <td
                    className="sticky left-0 z-20 border-r border-border p-0 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                    style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}
                  >
                    <div
                      className="overflow-hidden touch-manipulation"
                      style={{ width: nameColumnWidth, touchAction: 'pan-y' }}
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
                          className={`flex items-center gap-1 min-w-0 flex-shrink-0 py-1.5 px-2 ${!isHabitColumnExpanded ? 'justify-center' : ''}`}
                          style={{ width: nameColumnWidth }}
                        >
                          {isHabitColumnExpanded ? (
                            <div
                              data-habit-name-scroll
                              className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden seamless-scroll touch-pan-x"
                              style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                              <span className="text-xs font-medium text-foreground whitespace-nowrap inline-block">
                                {habit.name}
                              </span>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="flex-shrink-0 p-0.5 rounded touch-manipulation text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
                          className="flex items-center flex-shrink-0 bg-muted border-l border-border"
                          style={{ width: ACTIONS_WIDTH }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none"
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
                            className="h-8 w-8 rounded-none text-destructive"
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

                    // Same as desktop: day allowed = habit active on this day (excludes disabled checkboxes from daily %)
                    const isDayAllowed = isHabitActiveOnDay(habit, day);

                    const checkboxChecked = isMulti ? isFull : entriesCount > 0;
                    const checkboxState: boolean | 'indeterminate' = isMulti && isPartial ? 'indeterminate' : checkboxChecked;

                    return (
                      <td
                        key={`${habit.id}-${day.toISOString()}`}
                        className={`border-r border-border p-0.5 text-center ${
                          isDayAllowed ? 'cursor-pointer hover:bg-muted/50' : 'opacity-50'
                        } ${isCurrentDay ? 'bg-primary/5' : ''}`}
                        style={{ width: CELL_SIZE, minWidth: CELL_SIZE }}
                        onClick={() => {
                          if (!isDayAllowed && habit.frequency === 'monthly') {
                            handleMonthlyHabitDateChange(habit.id, day);
                            return;
                          }
                          if (!isDayAllowed) return;
                          handleCheckboxToggle(habit.id, day, !isFull);
                        }}
                        onTouchEnd={(e) => {
                          if (!isDayAllowed && habit.frequency === 'monthly') {
                            e.preventDefault();
                            handleMonthlyHabitDateChange(habit.id, day);
                          }
                        }}
                        role="button"
                        tabIndex={!isDayAllowed && habit.frequency === 'monthly' ? 0 : undefined}
                        onKeyDown={!isDayAllowed && habit.frequency === 'monthly' ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleMonthlyHabitDateChange(habit.id, day); } } : undefined}
                      >
                        <div className="flex flex-col items-center justify-center py-0.5">
                          <Checkbox
                            checked={checkboxState}
                            onCheckedChange={(c) => {
                              if (!isDayAllowed && habit.frequency === 'monthly') {
                                handleMonthlyHabitDateChange(habit.id, day);
                                return;
                              }
                              if (!isDayAllowed) return;
                              handleCheckboxToggle(habit.id, day, !!c);
                            }}
                            disabled={!isDayAllowed}
                            className={`h-4 w-4 ${checkboxState === true ? 'checkbox-full-green' : ''} ${!isDayAllowed ? 'pointer-events-none' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {isMulti && entriesCount > 0 && (
                            <span className={`text-[8px] font-semibold ${isFull ? 'text-green-600' : 'text-orange-600'}`}>
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
                    const progressColor =
                      progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500';
                    return (
                      <>
                        <td
                          className="border-r border-border px-1 py-1 text-center bg-card"
                          style={{ width: GOAL_WIDTH, minWidth: GOAL_WIDTH }}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <Target className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold text-foreground">{goal}</span>
                          </div>
                        </td>
                        <td
                          className="border-r border-border px-1 py-1 text-center bg-card"
                          style={{ width: ACTUAL_WIDTH, minWidth: ACTUAL_WIDTH }}
                        >
                          <span
                            className={`text-[10px] font-semibold ${
                              actual >= goal ? 'text-green-600' : actual >= goal * 0.5 ? 'text-blue-600' : 'text-foreground'
                            }`}
                          >
                            {actual}
                          </span>
                        </td>
                        <td
                          className="border-r border-border px-1 py-1 bg-card"
                          style={{ width: PROGRESS_WIDTH, minWidth: PROGRESS_WIDTH }}
                        >
                          <div className="flex items-center gap-1">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden min-w-0">
                              <div
                                className={`${progressColor} h-1.5 rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-medium text-muted-foreground shrink-0">
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

            {/* Progress Harian chart - sejajar kolom tanggal, ikut scroll horizontal */}
            <div className="flex border-t border-border bg-muted/30 flex-shrink-0">
              <div
                className="sticky left-0 z-20 flex-shrink-0 border-r border-border px-2 py-2 flex items-center justify-center bg-muted shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                style={{ width: nameColumnWidth, minWidth: nameColumnWidth }}
              >
                {isHabitColumnExpanded && (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('habitTracker.dailyProgressChart', 'Progress Harian')}
                  </span>
                )}
              </div>
              <div
                className="flex-shrink-0 overflow-hidden"
                style={{ width: monthDays.length * CELL_SIZE, minWidth: monthDays.length * CELL_SIZE }}
              >
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: CELL_SIZE / 2, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={4}
                      type="category"
                      scale="point"
                      padding={{ left: 0.5, right: 0.5 }}
                    />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      stroke="hsl(var(--muted-foreground))"
                      width={20}
                      domain={[0, 100]}
                      allowDecimals={false}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={() => ''}
                      label={{ value: '%', position: 'insideTopLeft', style: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' } }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '11px',
                      }}
                      formatter={(value: number) => [`${value}%`, t('habitTracker.dailyProgressChart', 'Progress Harian')]}
                      labelFormatter={(label) => `${t('habitTracker.day', 'Hari')} ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="pct"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 1.5, r: 2.5 }}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div
                className="flex-shrink-0 border-l border-border bg-muted/30"
                style={{ width: GOAL_WIDTH + ACTUAL_WIDTH + PROGRESS_WIDTH, minWidth: GOAL_WIDTH + ACTUAL_WIDTH + PROGRESS_WIDTH }}
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
