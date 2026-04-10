import { Card } from "@/mobile/components/ui/card";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface DetailedStatsCardProps {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalOvertime: number;
  statsLoading: boolean;
  /** Optional node to render in the header (e.g. period filter). */
  headerAction?: React.ReactNode;
}

export const DetailedStatsCard = ({ 
  presentDays, 
  lateDays, 
  absentDays, 
  totalOvertime, 
  statsLoading,
  headerAction,
}: DetailedStatsCardProps) => {
  const { t } = useAppTranslation();
  return (
    <Card className="bg-gradient-card border border-border">
      <div className="px-3 py-1.5 border-b border-border flex flex-row items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground tracking-tight">{t("reports.statsPeriodSelected", "Statistik Periode Dipilih")}</h2>
        {headerAction}
      </div>
      <div className="p-3 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.totalPresent", "Total Masuk")}</span>
          <span className="font-semibold text-foreground">
            {statsLoading ? "-" : t("reports.daysSuffix", "{{count}} hari", { count: presentDays || 0 })}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.late", "Terlambat")}</span>
          <span className="font-semibold text-warning">
            {statsLoading ? "-" : t("reports.daysSuffix", "{{count}} hari", { count: lateDays || 0 })}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.absent", "Tidak Hadir")}</span>
          <span className="font-semibold text-destructive">
            {statsLoading ? "-" : t("reports.daysSuffix", "{{count}} hari", { count: absentDays || 0 })}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.overtime", "Lembur")}</span>
          <span className="font-semibold text-primary">{t("reports.hoursSuffix", "{{count}} jam", { count: totalOvertime })}</span>
        </div>
      </div>
    </Card>
  );
};