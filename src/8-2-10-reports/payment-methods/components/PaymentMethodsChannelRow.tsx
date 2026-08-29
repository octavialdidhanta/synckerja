import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { PaymentMethodChannelRow } from "../lib/paymentMethodsTypes";

type Props = {
  row: PaymentMethodChannelRow;
};

export function PaymentMethodsChannelRow({ row }: Props) {
  return (
    <tr className="border-b border-border/60">
      <td className="px-3 py-2.5 pl-8 text-sm text-muted-foreground">{row.channelName}</td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums">{row.transactionCount}</td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums">
        {formatReportsMoney(row.totalCollected)}
      </td>
    </tr>
  );
}
