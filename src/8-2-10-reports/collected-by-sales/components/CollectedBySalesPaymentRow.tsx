import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { PAYMENT_KIND_I18N } from "../lib/paymentKindLabels";
import type { CollectedByPaymentRow } from "../lib/collectedBySalesTypes";

type Props = {
  row: CollectedByPaymentRow;
};

export function CollectedBySalesPaymentRow({ row }: Props) {
  const { t } = useAppTranslation();
  const label = PAYMENT_KIND_I18N[row.paymentKind];

  return (
    <tr className="border-t border-border/60 bg-background">
      <td className="px-3 py-2 pl-10 text-sm text-muted-foreground">{t(label.key, label.fallback)}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {row.transactionCount}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {formatReportsMoney(row.totalCollected)}
      </td>
    </tr>
  );
}
