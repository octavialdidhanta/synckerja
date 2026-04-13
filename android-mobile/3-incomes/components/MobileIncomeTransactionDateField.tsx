import { useMemo, useState } from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { Calendar } from "@/shared/components/ui/calendar";

function parseYyyyMmDd(value: string | undefined): Date {
  if (value && value.length >= 10) {
    const d = parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
    if (isValid(d)) return d;
  }
  return new Date();
}

type MobileIncomeTransactionDateFieldProps = {
  label: string;
  value: string | undefined;
  onChange: (yyyyMmDd: string) => void;
  errorMessage?: string;
  labelId?: string;
  disabled?: boolean;
};

/** Calendar dialog instead of `input type="date"` for Android WebView/Capacitor. */
export function MobileIncomeTransactionDateField({
  label,
  value,
  onChange,
  errorMessage,
  labelId = "transaction_date",
  disabled = false,
}: MobileIncomeTransactionDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseYyyyMmDd(value), [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor={labelId}>{label}</Label>
      <Button
        type="button"
        id={labelId}
        variant="outline"
        className={cn(
          "h-10 w-full justify-start text-left text-sm font-normal",
          !value && "text-muted-foreground",
        )}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{format(selected, "MMM d, yyyy")}</span>
      </Button>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!disabled) setOpen(o);
        }}
      >
        <DialogContent
          overlayClassName="z-[100]"
          className="z-[100] w-auto max-w-[min(92vw,380px)] gap-0 overflow-hidden rounded-lg border bg-background p-0 shadow-lg"
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <div className="p-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (date) {
                  onChange(format(date, "yyyy-MM-dd"));
                  setOpen(false);
                }
              }}
              initialFocus
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
