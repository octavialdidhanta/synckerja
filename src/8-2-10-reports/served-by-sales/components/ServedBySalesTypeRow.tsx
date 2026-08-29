import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { ServedBySalesTypeRow } from "../lib/servedBySalesTypes";

type Props = {
  row: ServedBySalesTypeRow;
};

export function ServedBySalesTypeRow({ row }: Props) {
  return (
    <tr className="border-t border-border bg-background">
      <td className="px-3 py-2 pl-10 text-sm text-muted-foreground">{row.salesTypeName}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {row.transactionCount}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {formatReportsMoney(row.grossSales)}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">
        {formatReportsMoney(row.netSales)}
      </td>
    </tr>
  );
}
