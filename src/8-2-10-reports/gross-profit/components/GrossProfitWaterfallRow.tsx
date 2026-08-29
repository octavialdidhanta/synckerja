import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatGrossProfitMoney } from "../lib/computeGrossProfitDisplay";
import type { GrossProfitWaterfallRow } from "../lib/computeGrossProfitWaterfall";
import { GrossProfitPercentPill } from "./GrossProfitPercentPill";

const LABEL_KEYS: Record<
  GrossProfitWaterfallRow["kind"],
  { key: string; fallback: string }
> = {
  grossSales: { key: "reports.grossProfit.grossSales", fallback: "Gross Sales" },
  discounts: { key: "reports.grossProfit.discounts", fallback: "Discounts" },
  refunds: { key: "reports.grossProfit.refunds", fallback: "Refunds" },
  netSales: { key: "reports.grossProfit.netSales", fallback: "Net Sales" },
  nonProductNet: {
    key: "reports.grossProfit.nonProductNet",
    fallback: "Non-product / custom revenue",
  },
  cogs: { key: "reports.grossProfit.cogs", fallback: "Cost of Goods Sold (COGS)" },
  cogsAdjustment: {
    key: "reports.grossProfit.cogsAdjustment",
    fallback: "Cost of Goods Sold (COGS) Adjustment",
  },
  cogsReversed: {
    key: "reports.grossProfit.cogsReversed",
    fallback: "COGS reversed on refund",
  },
  grossProfit: { key: "reports.grossProfit.grossProfit", fallback: "Gross Profit" },
};

type Props = {
  row: GrossProfitWaterfallRow;
  refundsTooltip?: string;
  nonProductTooltip?: string;
  cogsAdjustmentTooltip?: string;
  cogsReversedTooltip?: string;
  showDivider?: boolean;
};

export function GrossProfitWaterfallRow({
  row,
  refundsTooltip,
  nonProductTooltip,
  cogsAdjustmentTooltip,
  cogsReversedTooltip,
  showDivider,
}: Props) {
  const { t } = useAppTranslation();
  const labelMeta = LABEL_KEYS[row.kind];
  const label = t(labelMeta.key, labelMeta.fallback);

  return (
    <li>
      {showDivider ? <div className="border-t border-border" aria-hidden /> : null}
      <div
        className={cn(
          "flex items-center justify-between gap-4 px-4 py-3 text-sm",
          row.emphasize && "font-semibold text-foreground",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span>{label}</span>
          {row.showInfoTooltip && refundsTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label={refundsTooltip}
                >
                  <Info className="h-3.5 w-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {refundsTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {row.kind === "nonProductNet" && nonProductTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label={nonProductTooltip}
                >
                  <Info className="h-3.5 w-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {nonProductTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {row.kind === "cogsAdjustment" && cogsAdjustmentTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label={cogsAdjustmentTooltip}
                >
                  <Info className="h-3.5 w-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {cogsAdjustmentTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {row.kind === "cogsReversed" && cogsReversedTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label={cogsReversedTooltip}
                >
                  <Info className="h-3.5 w-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {cogsReversedTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {row.percent != null && row.percentVariant ? (
            <GrossProfitPercentPill percent={row.percent} variant={row.percentVariant} />
          ) : null}
        </span>
        <span
          className={cn(
            "shrink-0 tabular-nums",
            row.asDeduction && row.amount > 0 && "text-muted-foreground",
            row.highlight && "rounded bg-primary/15 px-2 py-0.5 text-primary",
          )}
        >
            {formatGrossProfitMoney(row.amount, {
              asDeduction: row.asDeduction && row.amount > 0,
            })}
        </span>
      </div>
    </li>
  );
}
