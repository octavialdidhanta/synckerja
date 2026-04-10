import { useState } from "react";
import { Calendar } from "@/mobile/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/mobile/components/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface CustomDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onDateRangeSelect: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

export const CustomDatePicker = ({ 
  isOpen, 
  onClose, 
  onDateRangeSelect,
  initialStartDate,
  initialEndDate 
}: CustomDatePickerProps) => {
  const { t } = useAppTranslation();
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [selectingStart, setSelectingStart] = useState(true);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    if (selectingStart) {
      setStartDate(date);
      setEndDate(undefined);
      setSelectingStart(false);
    } else {
      if (startDate && date >= startDate) {
        setEndDate(date);
      } else {
        // If selected date is before start date, make it the new start date
        setStartDate(date);
        setEndDate(undefined);
        setSelectingStart(false);
      }
    }
  };

  const handleApply = () => {
    if (startDate && endDate) {
      onDateRangeSelect(startDate, endDate);
      onClose();
    }
  };

  const handleReset = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectingStart(true);
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    return date >= startDate && date <= endDate;
  };

  const isDateRangeEnd = (date: Date) => {
    return endDate && date.getTime() === endDate.getTime();
  };

  const isDateRangeStart = (date: Date) => {
    return startDate && date.getTime() === startDate.getTime();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">{t('datePicker.title', 'Choose Date Range')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="flex justify-center gap-4 text-sm">
              <div 
                className={cn(
                  "px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  selectingStart ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                )}
                onClick={() => setSelectingStart(true)}
              >
                {t('datePicker.from', 'From:')} {startDate ? format(startDate, "dd MMM yyyy") : t('datePicker.selectDate', 'Select date')}
              </div>
              <div 
                className={cn(
                  "px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  !selectingStart ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                )}
                onClick={() => setSelectingStart(false)}
              >
                {t('datePicker.to', 'To:')} {endDate ? format(endDate, "dd MMM yyyy") : t('datePicker.selectDate', 'Select date')}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {selectingStart ? t('datePicker.selectStartDate', 'Select start date') : t('datePicker.selectEndDate', 'Select end date')}
            </p>
          </div>

          <Calendar
            mode="single"
            selected={selectingStart ? startDate : endDate}
            onSelect={handleDateSelect}
            className={cn("p-0 pointer-events-auto w-full")}
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4 w-full",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-medium",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex-1 text-center",
              row: "flex w-full mt-2",
              cell: "text-center text-sm relative p-0 flex-1 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 mx-auto rounded-md hover:bg-accent hover:text-accent-foreground",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
            modifiers={{
              range_start: startDate ? [startDate] : [],
              range_end: endDate ? [endDate] : [],
              range_middle: startDate && endDate ? 
                Array.from({ length: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) - 1 }, (_, i) => {
                  const date = new Date(startDate);
                  date.setDate(date.getDate() + i + 1);
                  return date;
                }) : []
            }}
            modifiersStyles={{
              range_start: { 
                backgroundColor: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))',
                borderRadius: '6px 0 0 6px'
              },
              range_end: { 
                backgroundColor: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))',
                borderRadius: '0 6px 6px 0'
              },
              range_middle: { 
                backgroundColor: 'hsl(var(--primary) / 0.2)',
                borderRadius: '0'
              }
            }}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="w-full sm:w-auto"
          >
            {t('datePicker.reset', 'Reset')}
          </Button>
          <Button 
            onClick={handleApply}
            disabled={!startDate || !endDate}
            className="w-full sm:w-auto"
          >
            {t('datePicker.apply', 'Apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};