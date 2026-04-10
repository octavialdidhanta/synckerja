import { Card } from "@/mobile/components/ui/card";
import { Calendar, TrendingUp } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface MonthlyStatsCardsProps {
  totalWorkingDays: number;
  attendancePercentage: number;
  statsLoading: boolean;
}

export const MonthlyStatsCards = ({ 
  totalWorkingDays, 
  attendancePercentage, 
  statsLoading 
}: MonthlyStatsCardsProps) => {
  const { t } = useAppTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Card className="p-3 bg-gradient-card border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">{t("reports.workingDays", "Hari Kerja")}</span>
        </div>
        <div className="text-xl font-bold text-primary">
          {statsLoading ? "-" : totalWorkingDays || 0}
        </div>
      </Card>
      <Card className="p-3 bg-gradient-card border border-border">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-success" />
          <span className="text-xs text-muted-foreground">{t("reports.attendance", "Kehadiran")}</span>
        </div>
        <div className="text-xl font-bold text-success">
          {statsLoading ? "-" : attendancePercentage || 0}%
        </div>
      </Card>
    </div>
  );
};