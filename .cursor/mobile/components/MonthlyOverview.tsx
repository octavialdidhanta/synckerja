import { BarChart3 } from "lucide-react";

export const MonthlyOverview = () => {
  return (
    <div className="px-4 py-3">
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Monthly Overview</h3>
            <p className="text-sm text-muted-foreground">Laporan kehadiran bulanan</p>
          </div>
        </div>
      </div>
    </div>
  );
};