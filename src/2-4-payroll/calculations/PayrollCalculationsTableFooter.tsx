interface PayrollCalculationsTableFooterProps {
  totalCalculations: number;
  paidCalculations: number;
  filteredCalculations?: number;
}

export function PayrollCalculationsTableFooter({
  totalCalculations,
  paidCalculations,
  filteredCalculations = totalCalculations,
}: PayrollCalculationsTableFooterProps) {
  return (
    <div className="bg-muted/30 border-border shrink-0 border-t px-4 py-2">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          Showing {filteredCalculations} of {totalCalculations} payroll calculations
        </span>
        <span className="text-xs">Paid: {paidCalculations} entries</span>
      </div>
    </div>
  );
}
