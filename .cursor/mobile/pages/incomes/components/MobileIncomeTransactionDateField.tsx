import { useMemo, useState } from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/features/ui/button";
import { Label } from "@/features/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/features/ui/dialog";
import { Calendar } from "@/mobile/components/ui/calendar";

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

/**
 * Avoids &lt;input type="date"&gt; on Android WebView/Capacitor — native picker often breaks layout.
 * Uses in-app Calendar in a stacked dialog (high z-index above parent modal).
 */
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
          "w-full h-10 justify-start text-left font-normal text-sm",
          !value && "text-muted-foreground"
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
          className="z-[100] w-auto max-w-[min(92vw,380px)] p-0 gap-0 overflow-hidden border rounded-lg shadow-lg bg-background"
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
