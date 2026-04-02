import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

export type CustomDatePickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onDateRangeSelect: (startDate: Date, endDate: Date) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
};

function toInputDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromInputDate(value: string) {
  // Use local midnight to avoid timezone shifts when parsing.
  const [yyyy, mm, dd] = value.split("-").map((p) => Number(p));
  return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
}

/**
 * Minimal CustomDatePicker used by `TaskFilters` for date-range filtering.
 * This is a lightweight implementation to unblock desktop tools build.
 */
export function CustomDatePicker({
  isOpen,
  onClose,
  onDateRangeSelect,
  initialStartDate,
  initialEndDate,
}: CustomDatePickerProps) {
  const [startValue, setStartValue] = useState<string>("");
  const [endValue, setEndValue] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    setStartValue(initialStartDate ? toInputDate(initialStartDate) : "");
    setEndValue(initialEndDate ? toInputDate(initialEndDate) : "");
  }, [isOpen, initialStartDate, initialEndDate]);

  const canApply = useMemo(() => Boolean(startValue && endValue), [startValue, endValue]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose date range</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start date</label>
            <Input type="date" value={startValue} onChange={(e) => setStartValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End date</label>
            <Input type="date" value={endValue} onChange={(e) => setEndValue(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStartValue("");
              setEndValue("");
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!canApply) return;
              onDateRangeSelect(fromInputDate(startValue), fromInputDate(endValue));
              onClose();
            }}
            disabled={!canApply}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white"
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

