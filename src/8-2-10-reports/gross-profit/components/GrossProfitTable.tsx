import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { buildGrossProfitWaterfallRows } from "../lib/computeGrossProfitWaterfall";
import type { GrossProfitMetrics } from "../lib/grossProfitTypes";
import { GrossProfitWaterfallRow } from "./GrossProfitWaterfallRow";

type Props = {
  metrics: GrossProfitMetrics;
};

export function GrossProfitTable({ metrics }: Props) {
  const { t } = useAppTranslation();
  const rows = buildGrossProfitWaterfallRows(metrics);
  const refundsTooltip = t(
    "reports.grossProfit.refundsTooltip",
    "Refunds in this period (by refund date). Fully refunded sales are already excluded from Net Sales and Gross Profit.",
  );
  const nonProductTooltip = t(
    "reports.grossProfit.nonProductTooltip",
    "Custom amounts and service lines from POS (e.g. custom keypad) — included in Net Sales but not in Profit by item and no COGS allocated.",
  );
  const cogsAdjustmentTooltip = t(
    "reports.grossProfit.cogsAdjustmentTooltip",
    "Manual COGS correction for this period. Positive amount increases COGS and reduces Gross Profit (Moka-style).",
  );
  const cogsReversedTooltip = t(
    "reports.grossProfit.cogsReversedTooltip",
    "HPP reversed when refunds were processed in this period (informational — already excluded from Net Sales via restatement).",
  );

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="h-2 bg-muted/60" aria-hidden />
      <TooltipProvider delayDuration={200}>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <GrossProfitWaterfallRow
              key={row.kind}
              row={row}
              refundsTooltip={refundsTooltip}
              nonProductTooltip={nonProductTooltip}
              cogsAdjustmentTooltip={cogsAdjustmentTooltip}
              cogsReversedTooltip={cogsReversedTooltip}
              showDivider={row.emphasize}
            />
          ))}
        </ul>
      </TooltipProvider>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {t(
          "reports.grossProfit.refundsFootnote",
          "Refunds show amounts refunded in this period (by refund date). Fully refunded sales are already excluded from Net Sales and Gross Profit.",
        )}
      </p>
    </div>
  );
}
