import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { Locale } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/ui/dialog';
import { Button } from '@/features/ui/button';
import { Label } from '@/features/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/ui/select';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useToast } from '@/features/ui/use-toast';
import { useIsMobile } from '@/mobile/hooks/use-mobile';

export type MonthlyHabitDateChangeModalData = {
  habitId: string;
  date: Date;
  newDate: number;
  oldDate: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  data: MonthlyHabitDateChangeModalData | null;
  currentMonth: Date;
  selectedOldDate: number | null;
  onSelectedOldDateChange: (value: number | null) => void;
};

const formatDateForDisplay = (currentMonth: Date, dayOfMonth: number, locale: Locale) => {
  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayOfMonth);
  return format(date, 'd MMMM yyyy', { locale });
};

export const MonthlyHabitDateChangeModal = ({
  open,
  onClose,
  data,
  currentMonth,
  selectedOldDate,
  onSelectedOldDateChange,
}: Props) => {
  const isMobile = useIsMobile();
  const { t, dateLocale } = useAppTranslation();
  const { toast } = useToast();
  const { filteredHabits, entries, updateHabit, addEntry, deleteEntry } = useHabitTracker();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!data) return null;

  const habit = filteredHabits.find((h) => h.id === data.habitId);
  if (!habit) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthEntries = entries.filter((e) => {
    if (e.habit_id !== habit.id) return false;
    const entryDate = new Date(e.entry_date);
    return entryDate >= monthStart && entryDate <= monthEnd;
  });
  const checkedDates = monthEntries.map((e) => {
    const entryDate = new Date(e.entry_date);
    return parseInt(format(entryDate, 'd'));
  });
  const availableDates = habit.monthly_dates || [];
  const selectableDates = availableDates.filter((d: number) => {
    const dateNum = Number(d);
    return dateNum !== data.newDate && !checkedDates.includes(dateNum);
  });

  const handleSubmit = async () => {
    if (!selectedOldDate) {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.monthlyHabit.selectOldDateRequired', 'Silakan pilih tanggal yang akan diganti'),
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const currentMonthlyDates = habit.monthly_dates || [];
      const newMonthlyDates = currentMonthlyDates
        .filter((d: number) => Number(d) !== selectedOldDate)
        .concat([data.newDate])
        .sort((a: number, b: number) => a - b);

      await updateHabit(habit.id, { monthly_dates: newMonthlyDates });

      const newDateStr = format(data.date, 'yyyy-MM-dd');
      const oldDateEntries = monthEntries.filter((e) => {
        const entryDate = new Date(e.entry_date);
        return parseInt(format(entryDate, 'd')) === selectedOldDate;
      });

      for (const entry of oldDateEntries) {
        await deleteEntry(entry.id);
      }
      if (oldDateEntries.length > 0) {
        await addEntry(habit.id, newDateStr, 1);
      }

      const locale = dateLocale || idLocale;
      toast({
        title: t('habitTracker.monthlyHabit.dateChanged', 'Tanggal diubah'),
        description: t('habitTracker.monthlyHabit.dateChangedDescriptionWithOld', 'Tanggal habit bulanan telah diubah dari tanggal {oldDate} ke tanggal {newDate}', {
          oldDate: formatDateForDisplay(currentMonth, selectedOldDate, locale),
          newDate: formatDateForDisplay(currentMonth, data.newDate, locale),
        }),
      });
      onClose();
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.monthlyHabit.changeDateError', 'Gagal mengubah tanggal habit'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const locale = dateLocale || idLocale;

  const renderFormContent = () => (
    <>
      <p className="text-sm text-muted-foreground">
        {t('habitTracker.monthlyHabit.changeDateQuestion', 'Apakah Anda ingin mengubah tanggal habit bulanan ini ke tanggal {date}?', {
          date: formatDateForDisplay(currentMonth, data.newDate, locale),
        })}
      </p>
      <div className="font-semibold bg-muted/50 p-2 rounded-md border border-border text-sm text-foreground">
        &quot;{habit.name}&quot;
      </div>
      {selectableDates.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t('habitTracker.monthlyHabit.selectOldDate', 'Pilih tanggal yang akan diganti:')}
          </Label>
          <Select
            value={selectedOldDate?.toString() ?? ''}
            onValueChange={(v) => onSelectedOldDateChange(v ? parseInt(v) : null)}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder={t('habitTracker.monthlyHabit.selectOldDatePlaceholder', 'Pilih tanggal')} />
            </SelectTrigger>
            <SelectContent>
              {selectableDates.map((d: number) => {
                const dateNum = Number(d);
                return (
                  <SelectItem key={d} value={dateNum.toString()}>
                    {formatDateForDisplay(currentMonth, dateNum, locale)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
          {t('habitTracker.monthlyHabit.noDateToReplace', 'Tidak ada tanggal yang bisa diganti')}
        </p>
      )}
      {selectedOldDate != null && (
        <p className="text-xs text-muted-foreground bg-primary/10 p-2 rounded border border-primary/20">
          {t('habitTracker.monthlyHabit.dateChangeInfo', 'Tanggal {oldDate} akan dinonaktifkan dan diganti dengan tanggal {newDate}', {
            oldDate: formatDateForDisplay(currentMonth, selectedOldDate, locale),
            newDate: formatDateForDisplay(currentMonth, data.newDate, locale),
          })}
        </p>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden'
            : 'max-w-md'
        }
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={
            isMobile
              ? 'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3'
              : undefined
          }
        >
          <DialogTitle className={isMobile ? 'text-lg font-semibold flex items-center gap-2' : 'flex items-center gap-2'}>
            <Edit className="w-5 h-5 text-primary" />
            {t('habitTracker.monthlyHabit.changeDateTitle', 'Ubah Tanggal Habit Bulanan')}
          </DialogTitle>
          {!isMobile && (
            <DialogDescription asChild>
              <div className="space-y-3 pt-1">
                {renderFormContent()}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        {isMobile ? (
          <div className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain min-h-0 px-4">
            <div className="space-y-3 pt-3 pb-4 text-sm">
              {renderFormContent()}
            </div>
          </div>
        ) : null}

        {isMobile ? (
          <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                {t('common.cancel', 'Batal')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!selectedOldDate || isSubmitting}
                className="min-w-[120px] flex items-center justify-center gap-1.5"
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('habitTracker.monthlyHabit.changing', 'Mengubah...')}</span>
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    {t('habitTracker.monthlyHabit.changeDateButton', 'Ubah Tanggal')}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel', 'Batal')}
            </Button>
            <Button
              type="button"
              disabled={!selectedOldDate || isSubmitting}
              onClick={handleSubmit}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('habitTracker.monthlyHabit.changing', 'Mengubah...')}</span>
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  {t('habitTracker.monthlyHabit.changeDateButton', 'Ubah Tanggal')}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
