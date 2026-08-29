import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";

type Props = {
  dateLabel: string;
  dayTotal: number;
  showTotal?: boolean;
};

export function TransactionsDateGroupHeader({ dateLabel, dayTotal, showTotal = true }: Props) {
  return (
    <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-gray-700">
      <span>{dateLabel}</span>
      {showTotal ? (
        <span className="tabular-nums text-gray-900">{formatReportsMoney(dayTotal)}</span>
      ) : null}
    </div>
  );
}
