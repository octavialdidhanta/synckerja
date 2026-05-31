import { useEffect, useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/mobile-app/components/ui/drawer';
import { Calendar } from '@/mobile-app/components/ui/calendar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type MobileDrawerDateFieldProps = {
  title: string;
  value?: Date;
  onSelect: (date: Date) => void;
  /** ISO date string (YYYY-MM-DD) — dates before this are disabled. */
  min?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When false, closes the drawer (e.g. parent modal closed). */
  containerOpen?: boolean;
};

/** Drawer calendar instead of `input type="date"` for Android WebView/Capacitor. */
export function MobileDrawerDateField({
  title,
  value,
  onSelect,
  min,
  placeholder,
  disabled = false,
  containerOpen = true,
}: MobileDrawerDateFieldProps) {
  const { t, dateFnsLocale } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const minDate = useMemo(
    () => (min ? startOfDay(new Date(`${min}T00:00:00`)) : undefined),
    [min],
  );
  const displayPlaceholder = placeholder ?? t('datePicker.selectDate', 'Select date');

  useEffect(() => {
    if (!containerOpen) {
      setOpen(false);
    }
  }, [containerOpen]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'h-10 w-full justify-between text-sm font-normal',
          !value && 'text-muted-foreground',
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          {value ? format(startOfDay(value), 'd MMM yyyy', { locale: dateFnsLocale }) : displayPlaceholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          overlayClassName="z-[60]"
          className="z-[60] mx-0 flex h-auto max-h-[90dvh] !w-full max-w-none min-w-0 flex-col items-stretch gap-0 rounded-t-2xl border-x-0 p-0 left-0 right-0 translate-x-0"
          style={{ left: 0, right: 0, width: '100%', maxWidth: '100%', marginInline: 0 }}
        >
          <DrawerHeader className="safe-area-top border-b border-border/60 px-4 pb-3 pt-4 text-center">
            <DrawerTitle className="w-full text-center text-base font-semibold leading-snug">{title}</DrawerTitle>
          </DrawerHeader>
          <div
            className={cn(
              'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-0 pb-1',
              '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            <div className="box-border w-full min-w-0 max-w-full self-stretch">
              <Calendar
                mode="single"
                locale={dateFnsLocale}
                defaultMonth={value ? startOfDay(value) : minDate ?? new Date()}
                selected={value ? startOfDay(value) : undefined}
                disabled={minDate ? { before: minDate } : undefined}
                onSelect={(date) => {
                  if (!date) return;
                  onSelect(startOfDay(date));
                  setOpen(false);
                }}
                initialFocus
                className="box-border !mx-0 w-full min-w-0 max-w-full bg-transparent !p-3 [direction:ltr]"
                classNames={{
                  months: 'flex w-full max-w-full flex-col items-stretch',
                  month: 'w-full max-w-full min-w-0 self-stretch space-y-3',
                  caption: 'relative flex h-11 w-full max-w-full items-center justify-center px-3 pt-1',
                  caption_label: 'relative z-0 text-center text-sm font-semibold',
                  table: 'w-full max-w-full border-collapse',
                  head_row: 'mt-1 flex w-full max-w-full',
                  head_cell:
                    'min-w-0 flex-1 text-center text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground',
                  row: 'mt-1.5 flex w-full max-w-full',
                  cell: 'relative min-w-0 flex-1 p-0 text-center text-sm focus-within:z-20',
                  day: cn(
                    'mx-auto flex h-9 w-9 items-center justify-center rounded-md font-normal',
                    'aria-selected:opacity-100',
                  ),
                  day_selected:
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                  day_today: 'bg-accent text-accent-foreground',
                  day_outside: 'text-muted-foreground opacity-40',
                  day_disabled: 'text-muted-foreground opacity-30',
                  day_hidden: 'invisible',
                }}
              />
            </div>
          </div>
          <div className="box-border flex w-full min-w-0 max-w-full flex-shrink-0 flex-col border-t border-border bg-card px-4 pb-4 pt-3">
            <DrawerClose asChild>
              <Button className="w-full max-w-full shrink-0" size="default" variant="default">
                {t('dailyTaskReport.filters.done', 'Done')}
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
