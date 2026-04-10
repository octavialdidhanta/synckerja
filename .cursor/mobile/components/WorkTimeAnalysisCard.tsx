import { Card } from "@/mobile/components/ui/card";
import { Clock } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface WorkTimeAnalysisCardProps {
  avgCheckIn: string;
  avgCheckOut: string;
  workingHours: number;
  workingMinutesRemainder: number;
}

export const WorkTimeAnalysisCard = ({ 
  avgCheckIn, 
  avgCheckOut, 
  workingHours,
  workingMinutesRemainder
}: WorkTimeAnalysisCardProps) => {
  const { t } = useAppTranslation();
  return (
    <Card className="bg-gradient-card border border-border">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t("reports.workTimeAnalysis", "Analisis Waktu Kerja")}</h2>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.avgCheckIn", "Rata-rata masuk")}</span>
          <span className="font-semibold text-foreground">{avgCheckIn}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.avgCheckOut", "Rata-rata pulang")}</span>
          <span className="font-semibold text-foreground">{avgCheckOut}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t("reports.totalWorkHours", "Total jam kerja")}</span>
          <span className="font-semibold text-primary">
            {workingHours > 0 || workingMinutesRemainder > 0 
              ? t("reports.hoursMinutes", "{{hours}} jam {{minutes}} menit", { hours: workingHours, minutes: workingMinutesRemainder })
              : t("reports.zeroHours", "0 jam")
            }
          </span>
        </div>
      </div>
    </Card>
  );
};