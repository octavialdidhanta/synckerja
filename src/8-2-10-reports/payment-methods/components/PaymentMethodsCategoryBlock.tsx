import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { PAYMENT_METHOD_CATEGORY_I18N } from "../lib/paymentMethodCategoryLabels";
import type { PaymentMethodsCategoryBlock } from "../lib/paymentMethodsTypes";
import { PaymentMethodsChannelRow } from "./PaymentMethodsChannelRow";

type Props = {
  block: PaymentMethodsCategoryBlock;
  expanded: boolean;
  onToggle: () => void;
};

export function PaymentMethodsCategoryBlock({ block, expanded, onToggle }: Props) {
  const { t } = useAppTranslation();
  const label = PAYMENT_METHOD_CATEGORY_I18N[block.category];

  return (
    <>
      <tr className="border-t border-border bg-muted/20">
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            {t(label.key, label.fallback)}
          </button>
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
          {block.transactionCount}
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
          {formatReportsMoney(block.totalCollected)}
        </td>
      </tr>
      {expanded
        ? block.channels.map((row) => (
            <PaymentMethodsChannelRow
              key={row.channelId ?? row.channelSlug}
              row={row}
            />
          ))
        : null}
    </>
  );
}

export function PaymentMethodsGrandTotalRow({
  transactionCount,
  totalCollected,
}: {
  transactionCount: number;
  totalCollected: number;
}) {
  const { t } = useAppTranslation();
  return (
    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
      <td className="px-3 py-3 text-sm">{t("reports.paymentMethods.grandTotal", "Grand Total")}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{transactionCount}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(totalCollected)}
      </td>
    </tr>
  );
}
