import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import type { ShiftPaymentMethodRow } from "../lib/shiftTypes";

type Props = {
  rows: ShiftPaymentMethodRow[];
};

function paymentMethodLabel(method: string, t: ReturnType<typeof useAppTranslation>["t"]): string {
  const key = method.toLowerCase();
  const map: Record<string, string> = {
    cash: t("reports.shift.paymentMethods.cash", "Cash"),
    card: t("reports.shift.paymentMethods.card", "Card / EDC"),
    edc: t("reports.shift.paymentMethods.card", "Card / EDC"),
    ewallet: t("reports.shift.paymentMethods.ewallet", "E-Wallet"),
    qris: t("reports.shift.paymentMethods.qris", "QRIS"),
    transfer: t("reports.shift.paymentMethods.transfer", "Transfer"),
    unknown: t("reports.shift.paymentMethods.other", "Other"),
  };
  return map[key] ?? method;
}

export function ShiftPaymentMethodsSection({ rows }: Props) {
  const { t } = useAppTranslation();

  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("reports.shift.detail.paymentMethods", "Payment Methods")}
      </h3>
      <div className="overflow-hidden rounded-md border border-border bg-background">
        {rows.map((row) => (
          <div
            key={row.paymentMethod}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
          >
            <span className="text-gray-800">
              {paymentMethodLabel(row.paymentMethod, t)}
            </span>
            <span className="tabular-nums font-medium text-gray-900">
              {formatReportsMoney(row.totalCollected)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
