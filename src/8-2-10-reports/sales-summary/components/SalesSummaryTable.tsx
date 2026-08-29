import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  formatSalesSummaryMoney,
  salesSummaryTotalsMismatch,
} from "../lib/computeSalesSummaryDisplay";
import type { SalesSummaryMetrics } from "../lib/salesSummaryTypes";

type RowDef = {
  id: keyof Pick<
    SalesSummaryMetrics,
    | "grossSales"
    | "discounts"
    | "refunds"
    | "netSales"
    | "gratuity"
    | "tax"
    | "rounding"
    | "totalCollected"
  >;
  labelKey: string;
  fallback: string;
  asDeduction?: boolean;
  emphasize?: boolean;
  highlight?: boolean;
};

const ROWS: RowDef[] = [
  { id: "grossSales", labelKey: "reports.salesSummary.grossSales", fallback: "Gross Sales" },
  {
    id: "discounts",
    labelKey: "reports.salesSummary.discounts",
    fallback: "Discounts",
    asDeduction: true,
  },
  {
    id: "refunds",
    labelKey: "reports.salesSummary.refunds",
    fallback: "Refunds",
    asDeduction: true,
  },
  {
    id: "netSales",
    labelKey: "reports.salesSummary.netSales",
    fallback: "Net Sales",
    emphasize: true,
  },
  { id: "gratuity", labelKey: "reports.salesSummary.gratuity", fallback: "Gratuity" },
  { id: "tax", labelKey: "reports.salesSummary.tax", fallback: "Tax" },
  {
    id: "rounding",
    labelKey: "reports.salesSummary.rounding",
    fallback: "Rounding",
    asDeduction: true,
  },
  {
    id: "totalCollected",
    labelKey: "reports.salesSummary.totalCollected",
    fallback: "Total Collected",
    emphasize: true,
    highlight: true,
  },
];

type Props = {
  metrics: SalesSummaryMetrics;
};

export function SalesSummaryTable({ metrics }: Props) {
  const { t } = useAppTranslation();
  const showMismatchFootnote = salesSummaryTotalsMismatch(metrics);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border border-border">
        <div className="h-2 bg-muted/60" aria-hidden />
        <ul className="divide-y divide-border">
          {ROWS.map((row) => {
            const amount = metrics[row.id];
            const showDivider = row.emphasize;
            return (
              <li key={row.id}>
                {showDivider ? <div className="border-t border-border" aria-hidden /> : null}
                <div
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3 text-sm",
                    row.emphasize && "font-semibold text-foreground",
                  )}
                >
                  <span>{t(row.labelKey, row.fallback)}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      row.asDeduction && amount > 0 && "text-muted-foreground",
                      row.highlight && "rounded bg-primary/15 px-2 py-0.5 text-primary",
                    )}
                  >
                    {formatSalesSummaryMoney(amount, { asDeduction: row.asDeduction })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {showMismatchFootnote ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "reports.salesSummary.totalsMismatchFootnote",
            "Total Collected may differ from Net Sales plus tax and gratuity when bills mix pricing methods or include non-product lines.",
          )}
        </p>
      ) : null}
    </div>
  );
}
