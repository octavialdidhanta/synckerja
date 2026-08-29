import { ChevronDown, ChevronRight } from "lucide-react";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { ServedByServerBlock } from "../lib/servedBySalesTypes";
import { ServedBySalesTypeRow } from "./ServedBySalesTypeRow";

type Props = {
  block: ServedByServerBlock;
  expanded: boolean;
  onToggle: () => void;
};

export function ServedBySalesServerBlock({ block, expanded, onToggle }: Props) {
  const visibleTypes = block.salesTypes.filter(
    (row) => row.transactionCount > 0 || row.netSales > 0.01,
  );

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
            {block.serverName}
          </button>
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
          {block.transactionCount}
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
          {formatReportsMoney(block.grossSales)}
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
          {formatReportsMoney(block.netSales)}
        </td>
      </tr>
      {expanded
        ? visibleTypes.map((row) => (
            <ServedBySalesTypeRow
              key={`${row.catalogSalesTypeId ?? "unknown"}-${row.salesTypeName}`}
              row={row}
            />
          ))
        : null}
    </>
  );
}

export function ServedBySalesGrandTotalRow({
  transactionCount,
  grossSales,
  netSales,
  label,
}: {
  transactionCount: number;
  grossSales: number;
  netSales: number;
  label: string;
}) {
  return (
    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
      <td className="px-3 py-3 text-sm">{label}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{transactionCount}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(grossSales)}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{formatReportsMoney(netSales)}</td>
    </tr>
  );
}
