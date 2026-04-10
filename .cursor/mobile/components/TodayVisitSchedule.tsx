import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Badge } from "@/mobile/components/ui/badge";
import { ScrollArea } from "@/mobile/components/ui/scroll-area";
import { Clock, MapPin, User, Phone, Building2 } from "lucide-react";
import { ClientVisit } from "@/mobile/hooks/useClientVisitData";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface TodayVisitScheduleProps {
  visits: ClientVisit[];
  periodLabel: string;
}

export const TodayVisitSchedule = ({ visits, periodLabel }: TodayVisitScheduleProps) => {
  const { t, language } = useAppTranslation();
  if (visits.length === 0) {
    return (
      <Card>
        <CardHeader className="p-3 pb-2.5 border-b border-border">
          <CardTitle className="text-base font-medium">
            {t("clientVisit.scheduleTitle", "Jadwal Kunjungan {{period}}", { period: periodLabel })}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-2 pb-3">
          <div className="text-center py-4 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t("clientVisit.noScheduledVisits", "Tidak ada kunjungan yang dijadwalkan")}</p>
            <p className="text-xs mt-1">{t("clientVisit.spontaneousHint", "Anda bisa mulai kunjungan spontan kapan saja")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 pb-2.5 border-b border-border">
        <CardTitle className="text-base font-medium">
          {t("clientVisit.scheduleTitle", "Jadwal Kunjungan {{period}}", { period: periodLabel })} ({visits.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pt-2 pb-3 pr-2">
        <ScrollArea className="h-[300px] pr-1">
          <div className="space-y-2 pr-0">
            {visits.map((visit) => (
              <div key={visit.id} className="border border-border rounded-lg p-2">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {visit.client?.company_name || t("clientVisit.unknownClient", "Unknown Client")}
                      </span>
                      <Badge variant={
                        visit.status === "completed" ? "default" :
                        visit.status === "in_progress" ? "secondary" :
                        visit.status === "cancelled" ? "destructive" : "outline"
                      }>
                        {visit.status === "scheduled" ? t("clientVisit.scheduled", "Terjadwal") :
                         visit.status === "in_progress" ? t("clientVisit.inProgress", "Berlangsung") :
                         visit.status === "completed" ? t("clientVisit.completedVisit", "Selesai") : t("clientVisit.cancelled", "Dibatalkan")}
                      </Badge>
                    </div>
                    
                    {visit.client?.contact_person && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <User className="h-3 w-3" />
                        <span>{visit.client.contact_person}</span>
                      </div>
                    )}
                    
                    {visit.client?.contact_phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Phone className="h-3 w-3" />
                        <span>{visit.client.contact_phone}</span>
                      </div>
                    )}
                    
                    {visit.client?.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{visit.client.address}</span>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground">{visit.visit_purpose}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {visit.planned_start_time && visit.planned_end_time
                        ? `${visit.planned_start_time} - ${visit.planned_end_time}`
                        : t("clientVisit.flexibleTime", "Waktu fleksibel")
                      }
                    </span>
                  </div>
                  
                  {visit.actual_start_time && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{t("clientVisit.startedAt", "Dimulai")}: {new Date(visit.actual_start_time).toLocaleTimeString(language === "id" ? "id-ID" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};