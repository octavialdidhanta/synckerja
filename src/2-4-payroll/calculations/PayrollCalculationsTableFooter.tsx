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
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredCalculations} of {totalCalculations} payroll calculations
        </span>
        <span className="text-xs text-muted-foreground/80">
          Total: {totalCalculations} calculations
        </span>
      </div>
    </div>
  );
}
