interface PayrollSidebarFooterProps {
  activeTab: string;
}

export function PayrollSidebarFooter({ activeTab }: PayrollSidebarFooterProps) {
  const isPeriods = activeTab === "periods";

  return (
    <div className="border-border bg-muted/30 shrink-0 border-t px-4 py-2">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{isPeriods ? "Showing latest payroll periods" : "Showing latest payroll runs"}</span>
        <span className="text-xs opacity-80">{isPeriods ? "Period overview" : "Run overview"}</span>
      </div>
    </div>
  );
}
