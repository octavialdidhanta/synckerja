import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, User } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface ClientVisitStatusProps {
  startTime?: string;
  endTime?: string;
  currentClient?: string;
  visitDuration?: string;
}

export const ClientVisitStatus = ({
  startTime,
  endTime,
  currentClient,
  visitDuration,
}: ClientVisitStatusProps) => {
  const { t } = useAppTranslation();
  return (
    <div className="px-3 mb-4">
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{t("clientVisit.startVisit", "Mulai Kunjungan")}</span>
              </div>
              <span className="text-sm font-medium">
                {startTime || '-'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{t("clientVisit.endVisit", "Selesai Kunjungan")}</span>
              </div>
              <span className="text-sm font-medium">
                {endTime || '-'}
              </span>
            </div>
            
            {currentClient && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{t("clientVisit.activeClient", "Client Aktif")}</span>
                </div>
                <span className="text-sm font-medium">
                  {currentClient}
                </span>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{t("clientVisit.visitDuration", "Durasi Kunjungan")}</span>
              </div>
              <span className="text-sm font-medium text-primary">
                {visitDuration || t("mobileHome.zeroHoursMinutes", "0 jam 0 menit")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};