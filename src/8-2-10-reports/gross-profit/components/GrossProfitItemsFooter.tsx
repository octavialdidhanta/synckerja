import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatGrossProfitMoney } from "../lib/computeGrossProfitDisplay";
import { sumNonProductBreakdownQty } from "../lib/computeGrossProfitNonProductDisplay";
import type { GrossProfitItemsFooterState } from "../lib/computeGrossProfitItemsTotals";
import type { GrossProfitNonProductRow } from "../lib/grossProfitNonProductTypes";
import { nonProductRowKey } from "../lib/grossProfitNonProductTypes";

const FOOT_CELL = "px-3 py-2.5 align-middle";
const FOOT_NUM = cn(FOOT_CELL, "text-right tabular-nums");

type Props = {
  footer: GrossProfitItemsFooterState;
  nonProductRows: GrossProfitNonProductRow[];
  nonProductLoading?: boolean;
};

export function GrossProfitItemsFooter({
  footer,
  nonProductRows,
  nonProductLoading,
}: Props) {
  const { t } = useAppTranslation();
  const [expanded, setExpanded] = useState(true);
  const {
    itemTotals,
    nonProductNet,
    summaryNetSales,
    showNonProductRow,
    matchesSummary,
  } = footer;

  if (itemTotals.netSales <= 0 && !showNonProductRow) return null;

  const hasBreakdown = nonProductRows.length > 0;
  const canExpand = showNonProductRow && (hasBreakdown || nonProductLoading);
  const nonProductQty = hasBreakdown ? sumNonProductBreakdownQty(nonProductRows) : null;

  return (
    <tfoot className="border-t border-border bg-muted/20 text-sm">
      <tr className="font-semibold text-foreground">
        <td className={FOOT_CELL}>
          {t("reports.grossProfit.items.footerTotal", "Total (products)")}
        </td>
        <td className={cn(FOOT_CELL, "text-muted-foreground")}>—</td>
        <td className={FOOT_NUM}>{itemTotals.qty}</td>
        <td className={FOOT_NUM}>{formatGrossProfitMoney(itemTotals.netSales)}</td>
        <td className={cn(FOOT_NUM, "text-muted-foreground")}>
          {formatGrossProfitMoney(itemTotals.cogs, { asDeduction: true })}
        </td>
        <td className={FOOT_NUM}>{formatGrossProfitMoney(itemTotals.grossProfit)}</td>
        <td className={FOOT_NUM}>{itemTotals.marginPct}%</td>
      </tr>

      {showNonProductRow ? (
        <>
          <tr className="text-foreground">
            <td className={FOOT_CELL} colSpan={2}>
              {canExpand ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 px-2 font-medium text-foreground hover:bg-muted/60"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  {t(
                    "reports.grossProfit.items.footerNonProduct",
                    "Non-product / custom (summary)",
                  )}
                  {hasBreakdown ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({nonProductRows.length})
                    </span>
                  ) : null}
                </Button>
              ) : (
                <span className="font-medium">
                  {t(
                    "reports.grossProfit.items.footerNonProduct",
                    "Non-product / custom (summary)",
                  )}
                </span>
              )}
            </td>
            <td className={cn(FOOT_NUM, "font-medium tabular-nums")}>
              {nonProductQty != null ? nonProductQty : nonProductLoading ? "…" : "—"}
            </td>
            <td className={cn(FOOT_NUM, "font-medium tabular-nums")}>
              {formatGrossProfitMoney(nonProductNet)}
            </td>
            <td className={cn(FOOT_NUM, "text-muted-foreground")}>—</td>
            <td className={cn(FOOT_NUM, "text-muted-foreground")}>—</td>
            <td className={FOOT_NUM}>—</td>
          </tr>

          {canExpand && expanded ? (
            nonProductLoading ? (
              <tr className="text-muted-foreground">
                <td className={cn(FOOT_CELL, "pl-8 text-xs")} colSpan={7}>
                  {t(
                    "reports.grossProfit.items.nonProductLoading",
                    "Loading service breakdown…",
                  )}
                </td>
              </tr>
            ) : (
              nonProductRows.map((row) => (
                <tr key={nonProductRowKey(row)} className="text-muted-foreground">
                  <td className={cn(FOOT_CELL, "pl-8")}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">{row.lineName}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          row.lineKind === "service"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-sky-100 text-sky-800",
                        )}
                      >
                        {row.lineKind === "service"
                          ? t("reports.grossProfit.items.nonProductKindService", "Service")
                          : t("reports.grossProfit.items.nonProductKindCustom", "Custom")}
                      </span>
                    </div>
                  </td>
                  <td className={FOOT_CELL}>{row.subName || "—"}</td>
                  <td className={FOOT_NUM}>{row.qty}</td>
                  <td className={FOOT_NUM}>{formatGrossProfitMoney(row.netSales)}</td>
                  <td className={FOOT_NUM}>—</td>
                  <td className={FOOT_NUM}>—</td>
                  <td className={FOOT_NUM}>—</td>
                </tr>
              ))
            )
          ) : null}

          {matchesSummary ? (
            <tr className="border-t border-dashed border-border font-semibold text-foreground">
              <td className={FOOT_CELL} colSpan={3}>
                {t("reports.grossProfit.items.footerSummaryNet", "Summary net sales")}
              </td>
              <td className={cn(FOOT_NUM, "text-primary")}>
                {formatGrossProfitMoney(summaryNetSales)}
              </td>
              <td className={FOOT_NUM}>—</td>
              <td className={FOOT_NUM}>—</td>
              <td className={FOOT_NUM}>—</td>
            </tr>
          ) : null}
        </>
      ) : null}
    </tfoot>
  );
}

type ReconciliationNoteProps = {
  footer: GrossProfitItemsFooterState;
};

export function GrossProfitItemsReconciliationNote({ footer }: ReconciliationNoteProps) {
  const { t } = useAppTranslation();
  const { itemTotals, summaryNetSales, showNonProductRow, matchesSummary } = footer;

  if (itemTotals.netSales <= 0 && !showNonProductRow) return null;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 border-t border-border bg-muted/10 px-3 py-2.5 text-xs leading-relaxed",
        matchesSummary && "text-emerald-700 dark:text-emerald-400",
        !matchesSummary && "text-muted-foreground",
      )}
    >
      {matchesSummary ? (
        <>
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {t(
              "reports.grossProfit.items.footerMatchesSummary",
              "Product total + non-product = summary Net Sales ({{amount}}).",
              { amount: formatGrossProfitMoney(summaryNetSales) },
            )}
          </span>
        </>
      ) : (
        t(
          "reports.grossProfit.items.productOnlyFootnote",
          "This table totals product lines only. Net Sales above may be higher if the bill includes custom amounts or non-product lines.",
        )
      )}
    </p>
  );
}
