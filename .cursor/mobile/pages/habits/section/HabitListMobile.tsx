import React, { useState } from 'react';
import { format } from 'date-fns';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { Checkbox } from '@/features/ui/checkbox';
import { Button } from '@/features/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
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
import { useToast } from '@/features/ui/use-toast';

const isHabitActiveOnDay = (
  habit: { is_active?: boolean; frequency: string; weekly_days?: number[]; monthly_dates?: number[] },
  day: Date
): boolean => {
  if (!habit.is_active) return false;
  if (habit.frequency === 'weekly') {
    if (habit.weekly_days?.length) {
      const dayOfWeek = day.getDay();
      return habit.weekly_days.map(Number).includes(dayOfWeek);
    }
    return true;
  }
  if (habit.frequency === 'monthly') {
    if (habit.monthly_dates?.length) {
      const dayOfMonth = parseInt(format(day, 'd'), 10);
      return habit.monthly_dates.map(Number).includes(dayOfMonth);
    }
    return false;
  }
  return true;
};

const isHabitCompletedOnDay = (
  habit: { id: string; target_count?: number },
  day: Date,
  entriesList: { habit_id: string; entry_date: string }[]
): boolean => {
  const dateStr = format(day, 'yyyy-MM-dd');
  const dayEntries = entriesList.filter((e) => e.habit_id === habit.id && e.entry_date === dateStr);
  if (habit.target_count && habit.target_count > 1) {
    return dayEntries.length >= habit.target_count;
  }
  return dayEntries.length > 0;
};

export const HabitListMobile = () => {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const {
    filteredHabits,
    entries,
    addEntry,
    deleteEntry,
    deleteHabit,
  } = useHabitTracker();

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<{ id: string; name: string } | null>(null);
  const [targetCountModal, setTargetCountModal] = useState<{ habitId: string; date: Date } | null>(null);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const getEntryForDate = (habitId: string, date: Date) => {
    const d = format(date, 'yyyy-MM-dd');
    return entries.find((e) => e.habit_id === habitId && e.entry_date === d);
  };

  const habitsForToday = filteredHabits.filter((h) => isHabitActiveOnDay(h, today));

  const handleToggleToday = async (habitId: string, checked: boolean) => {
    const habit = filteredHabits.find((h) => h.id === habitId);
    if (!habit) return;

    if (habit.frequency === 'daily' && habit.target_count && habit.target_count > 1) {
      setTargetCountModal({ habitId, date: today });
      return;
    }

    try {
      if (checked) {
        await addEntry(habitId, todayStr, 1);
        toast({ title: t('habitTracker.entryLogged', 'Entry dicatat'), variant: 'default' });
      } else {
        const entry = getEntryForDate(habitId, today);
        if (entry) {
          await deleteEntry(entry.id);
          toast({ title: t('habitTracker.entryRemoved', 'Entry dihapus'), variant: 'default' });
        }
      }
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.updateFailed', 'Gagal memperbarui'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHabit = async () => {
    if (!habitToDelete) return;
    try {
      await deleteHabit(habitToDelete.id);
      toast({
        title: t('habitTracker.habitDeleted', 'Habit dihapus'),
        variant: 'default',
      });
      setHabitToDelete(null);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.deleteFailed', 'Gagal menghapus habit'),
        variant: 'destructive',
      });
    }
  };

  const isCompletedToday = (habitId: string) => {
    const habit = filteredHabits.find((h) => h.id === habitId);
    if (!habit) return false;
    return isHabitCompletedOnDay(habit, today, entries);
  };

  if (habitsForToday.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground text-center">
          {t('habitTracker.noHabitsToday', 'Tidak ada habit untuk hari ini. Tambah habit atau periksa jadwal.')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {habitsForToday.map((habit) => {
          const completed = isCompletedToday(habit.id);
          return (
            <div
              key={habit.id}
              className="bg-card rounded-lg border border-border p-3 flex items-center gap-3"
            >
              <Checkbox
                checked={completed}
                onCheckedChange={(checked) => handleToggleToday(habit.id, !!checked)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{habit.name}</p>
                {habit.frequency && (
                  <p className="text-xs text-muted-foreground">
                    {habit.frequency === 'daily'
                      ? t('habitTracker.frequency.daily', 'Harian')
                      : habit.frequency === 'weekly'
                        ? t('habitTracker.frequency.weekly', 'Mingguan')
                        : t('habitTracker.frequency.monthly', 'Bulanan')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditingHabitId(habit.id)}
                  aria-label={t('common.edit', 'Edit')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setHabitToDelete({ id: habit.id, name: habit.name })}
                  aria-label={t('common.delete', 'Hapus')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
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
    </>
  );
};
