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
  item_category?: string | null;
  calculated_amount: number;
};

type BreakdownLine = {
  label: string;
  amount: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculationId: string | null;
  employeeName?: string;
  periodLabel?: string;
  grossPay?: number;
  takeHomePay?: number;
  totalDeductions?: number;
  totalTaxDeductions?: number;
  totalPenalties?: number;
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
  return item.item_name?.trim() || "Potongan";
}

function isBpjsItem(item: PayrollItemRow) {
  const cat = (item.item_category || "").toLowerCase();
  const name = lineLabel(item).toLowerCase();
  return cat.startsWith("bpjs") || name.includes("bpjs");
}

function isPenaltyItem(item: PayrollItemRow) {
  return (item.item_category || "").toLowerCase() === "penalty";
}

function isTaxItem(item: PayrollItemRow) {
  return item.item_type === "tax";
}

function buildBreakdownLines(
  items: PayrollItemRow[],
  totalTaxDeductions: number,
  totalPenalties: number,
): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  const taxItems = items.filter(isTaxItem);

  if (taxItems.length > 0) {
    for (const item of taxItems) {
      lines.push({ label: lineLabel(item), amount: Number(item.calculated_amount) || 0 });
    }
  } else if (totalTaxDeductions > 0) {
    lines.push({ label: "PPh 21", amount: totalTaxDeductions });
  }

  for (const item of items.filter((i) => isBpjsItem(i))) {
    lines.push({ label: lineLabel(item), amount: Number(item.calculated_amount) || 0 });
  }

  for (const item of items.filter((i) => !isBpjsItem(i) && !isPenaltyItem(i) && !isTaxItem(i))) {
    lines.push({ label: lineLabel(item), amount: Number(item.calculated_amount) || 0 });
  }

  for (const item of items.filter(isPenaltyItem)) {
    lines.push({ label: lineLabel(item), amount: Number(item.calculated_amount) || 0 });
  }

  if (totalPenalties > 0 && !items.some(isPenaltyItem)) {
    lines.push({ label: "Penalti Kehadiran", amount: totalPenalties });
  }

  return lines.filter((l) => l.amount > 0);
}

export function PayrollDeductionBreakdownDialog({
  open,
  onOpenChange,
  calculationId,
  employeeName,
  periodLabel,
  grossPay = 0,
  takeHomePay = 0,
  totalDeductions = 0,
  totalTaxDeductions = 0,
  totalPenalties = 0,
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
        .select("item_name, item_type, item_category, calculated_amount")
        .eq("payroll_calculation_id", calculationId)
        .in("item_type", ["deduction", "tax"])
        .order("item_type", { ascending: true });

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

  const totalPotongan =
    grossPay > 0 && takeHomePay >= 0 ? grossPay - takeHomePay : totalDeductions + totalPenalties;

  const breakdownLines = useMemo(
    () => buildBreakdownLines(items, totalTaxDeductions, totalPenalties),
    [items, totalTaxDeductions, totalPenalties],
  );

  const linesSum = breakdownLines.reduce((s, l) => s + l.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Potongan</DialogTitle>
          <DialogDescription>
            {employeeName}
            {periodLabel ? ` · ${periodLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-sm">Total potongan</span>
            <span className="text-destructive text-lg font-bold tabular-nums">
              {formatCurrency(totalPotongan)}
            </span>
          </div>

          {grossPay > 0 && takeHomePay >= 0 && (
            <p className="text-muted-foreground text-xs">
              Bruto {formatCurrency(grossPay)} − THP {formatCurrency(takeHomePay)}
            </p>
          )}

          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat rincian…
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : breakdownLines.length === 0 ? (
            <p className="text-muted-foreground text-sm">Tidak ada rincian potongan.</p>
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
              {Math.abs(linesSum - totalPotongan) > 1 && (
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
