import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";

type PayrollItemRow = {
  item_name: string;
  item_type: string;
  calculated_amount: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculationId: string | null;
  employeeName?: string;
  periodLabel?: string;
  totalAllowances?: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function lineLabel(item: PayrollItemRow) {
  return item.item_name?.trim() || "Tunjangan";
}

export function PayrollAllowanceBreakdownDialog({
  open,
  onOpenChange,
  calculationId,
  employeeName,
  periodLabel,
  totalAllowances = 0,
}: Props) {
  const [items, setItems] = useState<PayrollItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !calculationId) {
      setItems([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const { data, error: qError } = await supabase
        .from("payroll_items")
        .select("item_name, item_type, calculated_amount")
        .eq("payroll_calculation_id", calculationId)
        .eq("item_type", "allowance")
        .order("item_name", { ascending: true });

      if (cancelled) return;

      if (qError) {
        setError(qError.message);
        setItems([]);
      } else {
        setItems((data ?? []) as PayrollItemRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, calculationId]);

  const breakdownLines = useMemo(
    () =>
      items
        .map((item) => ({
          label: lineLabel(item),
          amount: Number(item.calculated_amount) || 0,
        }))
        .filter((l) => l.amount > 0),
    [items],
  );

  const linesSum = breakdownLines.reduce((s, l) => s + l.amount, 0);
  const totalDisplay = totalAllowances > 0 ? totalAllowances : linesSum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tunjangan</DialogTitle>
          <DialogDescription>
            {employeeName}
            {periodLabel ? ` · ${periodLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-sm">Total tunjangan</span>
            <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalDisplay)}
            </span>
          </div>

          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat rincian…
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : breakdownLines.length === 0 ? (
            <p className="text-muted-foreground text-sm">Tidak ada rincian tunjangan.</p>
          ) : (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="space-y-2">
                {breakdownLines.map((line, index) => (
                  <div key={`${line.label}-${index}`} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground min-w-0 truncate">{line.label}</span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
              {totalAllowances > 0 && Math.abs(linesSum - totalAllowances) > 1 && (
                <p className="text-muted-foreground mt-2 border-t border-border/60 pt-2 text-xs">
                  Rincian baris {formatCurrency(linesSum)} — selisih pembulatan dengan total tersimpan.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
