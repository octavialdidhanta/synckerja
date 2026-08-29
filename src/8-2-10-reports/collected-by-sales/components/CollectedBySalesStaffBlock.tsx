import { ChevronDown, ChevronRight } from "lucide-react";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import type { CollectedByStaffBlock } from "../lib/collectedBySalesTypes";
import { CollectedBySalesPaymentRow } from "./CollectedBySalesPaymentRow";

type Props = {
  block: CollectedByStaffBlock;
  expanded: boolean;
  onToggle: () => void;
};

export function CollectedBySalesStaffBlock({ block, expanded, onToggle }: Props) {
  const visiblePayments = block.payments.filter(
    (row) => row.transactionCount > 0 || row.totalCollected > 0.01,
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
            {block.collectorName}
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
        ? visiblePayments.map((row) => (
            <CollectedBySalesPaymentRow key={row.paymentKind} row={row} />
          ))
        : null}
    </>
  );
}

export function CollectedBySalesGrandTotalRow({
  transactionCount,
  totalCollected,
  label,
}: {
  transactionCount: number;
  totalCollected: number;
  label: string;
}) {
  return (
    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
      <td className="px-3 py-3 text-sm">{label}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{transactionCount}</td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">
        {formatReportsMoney(totalCollected)}
      </td>
    </tr>
  );
}
