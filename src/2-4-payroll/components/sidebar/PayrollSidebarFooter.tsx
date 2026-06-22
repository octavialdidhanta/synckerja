interface PayrollSidebarFooterProps {
  activeTab: string;
}

export function PayrollSidebarFooter({ activeTab }: PayrollSidebarFooterProps) {
  const isPeriods = activeTab === "periods";

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{isPeriods ? "Showing latest payroll periods" : "Showing latest payroll runs"}</span>
        <span className="text-xs text-muted-foreground/80">
          {isPeriods ? "Period overview" : "Run overview"}
        </span>
      </div>
    </div>
  );
}
