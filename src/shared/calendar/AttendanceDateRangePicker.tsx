import { useState } from "react";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface AttendanceDateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onDateRangeSelect: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

/** Date range dialog for attendance filters (from synckerja-reference mobile CustomDatePicker). */
export function AttendanceDateRangePicker({
  isOpen,
  onClose,
  onDateRangeSelect,
  initialStartDate,
  initialEndDate,
}: AttendanceDateRangePickerProps) {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-auto w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {t("datePicker.title", "Choose date range")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 text-center">
            <div className="flex justify-center gap-4 text-sm">
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2 transition-colors",
                  selectingStart
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
                onClick={() => setSelectingStart(true)}
              >
                {t("datePicker.from", "From:")}{" "}
                {startDate
                  ? format(startDate, "dd MMM yyyy")
                  : t("datePicker.selectDate", "Select date")}
              </button>
              <button
                type="button"
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2 transition-colors",
                  !selectingStart
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
                onClick={() => setSelectingStart(false)}
              >
                {t("datePicker.to", "To:")}{" "}
                {endDate
                  ? format(endDate, "dd MMM yyyy")
                  : t("datePicker.selectDate", "Select date")}
              </button>
            </div>

            <p className="text-muted-foreground text-xs">
              {selectingStart
                ? t("datePicker.selectStartDate", "Select start date")
                : t("datePicker.selectEndDate", "Select end date")}
            </p>
          </div>

          <Calendar
            mode="single"
            selected={selectingStart ? startDate : endDate}
            onSelect={handleDateSelect}
            className={cn("pointer-events-auto w-full p-0")}
            classNames={{
              months: "flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4",
              month: "w-full space-y-4",
              caption: "relative flex items-center justify-center pt-1",
              caption_label: "text-sm font-medium",
              nav: "flex items-center space-x-1",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex w-full",
              head_cell:
                "text-muted-foreground w-8 flex-1 rounded-md text-center text-[0.8rem] font-normal",
              row: "mt-2 flex w-full",
              cell: "relative flex-1 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
              day: "mx-auto h-8 w-8 rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100",
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
            {t("datePicker.reset", "Reset")}
          </Button>
          <Button
            onClick={handleApply}
            disabled={!startDate || !endDate}
            className="w-full sm:w-auto"
          >
            {t("datePicker.apply", "Apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
