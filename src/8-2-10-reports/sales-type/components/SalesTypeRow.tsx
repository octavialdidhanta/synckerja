import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { SalesTypeRow } from "../lib/salesTypeTypes";

type Props = {
  row: SalesTypeRow;
};

export function SalesTypeRowView({ row }: Props) {
  return (
    <tr className="border-b border-border/60">
      <td className="px-3 py-2.5 text-sm text-foreground">{row.salesTypeName}</td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums">{row.transactionCount}</td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums">
        {formatReportsMoney(row.grossSales)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums">
        {formatReportsMoney(row.netSales)}
      </td>
    </tr>
  );
}
