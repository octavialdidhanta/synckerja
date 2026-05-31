import { Card, CardContent, CardHeader, CardTitle } from "@/mobile-app/components/ui/card";
import { Badge } from "@/mobile-app/components/ui/badge";
import { Button } from "@/mobile-app/components/ui/button";
import { Clock, MapPin, User, Phone, Building2, Navigation, MessageCircle } from "lucide-react";
import { ClientVisit } from "@/mobile/1-client-visit/hooks/useClientVisitData";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { toast } from "@/shared/hooks/use-toast";
import { openGoogleMapsDirections } from "@/mobile-app/utils/openGoogleMaps";
import {
  formatVisitPlannedTimeRange,
  getVisitMapsOptions,
  getVisitSiteAddress,
} from "@/mobile/1-client-visit/utils/visitLocationDisplay";

interface TodayVisitScheduleProps {
  visits: ClientVisit[];
  periodLabel: string;
}

export const TodayVisitSchedule = ({ visits, periodLabel }: TodayVisitScheduleProps) => {
  const { t, language } = useAppTranslation();

  const handleOpenGoogleMaps = async (visit: ClientVisit) => {
    const opened = await openGoogleMapsDirections(getVisitMapsOptions(visit));
    if (!opened) {
      toast({
        title: t("clientVisit.locationNotAvailable", "Lokasi belum tersedia untuk navigasi"),
        variant: "destructive",
      });
    }
  };

  const handleCall = (phone: string) => {
    if (!phone) {
      toast({
        title: t("clientVisit.phoneNotAvailable", "Nomor HP tidak tersedia"),
        variant: "destructive",
      });
      return;
    }
    window.open(`tel:${phone}`, "_self");
  };

  const handleWhatsApp = (phone: string, companyName: string) => {
    if (!phone) {
      toast({
        title: t("clientVisit.phoneNotAvailable", "Nomor HP tidak tersedia"),
        variant: "destructive",
      });
      return;
    }
    const message = `Halo, saya ingin mengatur jadwal kunjungan ke ${companyName}`;
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

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
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="p-3 pb-2.5 border-b border-border">
        <CardTitle className="text-base font-medium">
          {t("clientVisit.scheduleTitle", "Jadwal Kunjungan {{period}}", { period: periodLabel })} ({visits.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pt-2 pb-3">
        <div className="space-y-2">
          {visits.map((visit) => {
            const siteAddress = getVisitSiteAddress(visit, t("clientVisit.addressNotSet", "Alamat belum diatur"));
            const plannedTime = formatVisitPlannedTimeRange(
              visit,
              t("clientVisit.flexibleTime", "Waktu fleksibel"),
            );
            const canNavigate = Boolean(visit.validated_location_id && visit.validated_location);

            return (
              <div key={visit.id} className="min-w-0 overflow-hidden border border-border rounded-lg p-2">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {visit.client?.company_name || t("clientVisit.unknownClient", "Unknown Client")}
                      </span>
                      <Badge
                        variant={
                          visit.status === "completed"
                            ? "default"
                            : visit.status === "ongoing"
                              ? "secondary"
                              : visit.status === "cancelled"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {visit.status === "scheduled"
                          ? t("clientVisit.scheduled", "Terjadwal")
                          : visit.status === "ongoing"
                            ? t("clientVisit.inProgress", "Berlangsung")
                            : visit.status === "completed"
                              ? t("clientVisit.completedVisit", "Selesai")
                              : t("clientVisit.cancelled", "Dibatalkan")}
                      </Badge>
                    </div>

                    {visit.client?.contact_person && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <User className="h-3 w-3 shrink-0" />
                        <span>{visit.client.contact_person}</span>
                      </div>
                    )}

                    {visit.client?.contact_phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{visit.client.contact_phone}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-1 text-xs text-muted-foreground mb-1">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      <span className="break-words">{siteAddress}</span>
                    </div>

                    <p className="text-sm text-muted-foreground">{visit.visit_purpose}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border pt-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 min-w-0">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{plannedTime}</span>
                    </div>

                    {visit.actual_start_time && (
                      <div className="flex items-center gap-1 shrink-0">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {t("clientVisit.startedAt", "Dimulai")}:{" "}
                          {new Date(visit.actual_start_time).toLocaleTimeString(
                            language === "id" ? "id-ID" : "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {visit.client?.contact_phone ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-xs"
                        onClick={() => handleCall(visit.client?.contact_phone || "")}
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        {t("clientVisit.call", "Telepon")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-xs"
                        onClick={() =>
                          handleWhatsApp(
                            visit.client?.contact_phone || "",
                            visit.client?.company_name || "",
                          )
                        }
                      >
                        <MessageCircle className="h-3 w-3 mr-1" />
                        WhatsApp
                      </Button>
                    </div>
                  ) : null}

                  {canNavigate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-full text-xs"
                      onClick={() => void handleOpenGoogleMaps(visit)}
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      {t("clientVisit.openGoogleMaps", "Google Maps")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
