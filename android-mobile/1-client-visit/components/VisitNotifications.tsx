import { Card, CardContent, CardHeader, CardTitle } from "@/mobile-app/components/ui/card";
import { Badge } from "@/mobile-app/components/ui/badge";
import { Button } from "@/mobile-app/components/ui/button";
import { Dialog, DialogContent } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/mobile-app/components/ui/select";
import { Bell, Clock, MapPin, User, Phone, MessageCircle, ChevronRight, Navigation } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { openGoogleMapsDirections } from "@/mobile-app/utils/openGoogleMaps";
import {
  formatVisitPlannedTimeRange,
  getPendingScheduledVisitsForToday,
  getVisitMapsOptions,
  getVisitSiteAddress,
} from "@/mobile/1-client-visit/utils/visitLocationDisplay";
import type { ClientVisit } from "@/mobile/1-client-visit/hooks/useClientVisitData";
import { getLocalDateYmd } from "@/shared/lib/date/getLocalDateYmd";
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from "@/mobile/1-profile/components/ProfileInfoModalParts";

interface VisitNotification {
  id: string;
  title: string;
  message: string;
  notification_type: "reminder" | "overdue" | "completed";
  scheduled_for: string;
  is_read: boolean;
  client_visit?: {
    client?: {
      company_name: string;
    };
    visit_purpose: string;
  };
}

interface VisitNotificationsProps {
  notifications?: VisitNotification[];
  onMarkAsRead?: (notificationId: string) => void;
  /** Visits in the current period — only `scheduled` rows for today are listed here. */
  scheduledVisits?: ClientVisit[];
  headerAction?: React.ReactNode;
}

export const VisitNotifications = ({
  notifications = [],
  scheduledVisits = [],
  headerAction,
}: VisitNotificationsProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const [priorities, setPriorities] = useState<Record<string, string>>({});
  const [detailVisit, setDetailVisit] = useState<ClientVisit | null>(null);
  const todayYmd = getLocalDateYmd();
  const pendingVisits = useMemo(
    () => getPendingScheduledVisitsForToday(scheduledVisits, todayYmd),
    [scheduledVisits, todayYmd],
  );
  const sectionTitle = t("clientVisit.scheduledVisitsToday", "Kunjungan Terjadwal Hari Ini");

  const handlePriorityChange = (visitId: string, priority: string) => {
    setPriorities((prev) => ({
      ...prev,
      [visitId]: priority,
    }));
    toast({
      title: t("clientVisit.priorityUpdated", "Prioritas Updated"),
      description: t("clientVisit.priorityUpdatedDesc", "Prioritas visit berhasil diubah ke {{priority}}", {
        priority,
      }),
    });
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

  const handleOpenGoogleMaps = async (visit: ClientVisit) => {
    const opened = await openGoogleMapsDirections(getVisitMapsOptions(visit));
    if (!opened) {
      toast({
        title: t("clientVisit.locationNotAvailable", "Lokasi belum tersedia untuk navigasi"),
        variant: "destructive",
      });
    }
  };

  const truncateAddress = (address: string, maxLength: number = 50) => {
    if (!address) return t("clientVisit.addressNotSet", "Alamat belum diatur");
    return address.length > maxLength ? `${address.substring(0, maxLength)}...` : address;
  };

  const renderVisitDetailBody = (visit: ClientVisit) => {
    const startTime = visit.planned_start_time?.slice(0, 5) || "—";
    const endTime = visit.planned_end_time?.slice(0, 5) || "—";
    const address = getVisitSiteAddress(visit, t("clientVisit.addressNotSet", "Alamat belum diatur"));

    return (
      <>
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-medium">{t("clientVisit.clientInfo", "Informasi Client")}</h4>
          {visit.client?.contact_person && (
            <p className="text-sm text-muted-foreground">
              <strong>{t("clientVisit.contactPerson", "Contact Person")}:</strong> {visit.client.contact_person}
            </p>
          )}
          {visit.client?.contact_phone && (
            <p className="text-sm text-muted-foreground">
              <strong>{t("clientVisit.phone", "Phone")}:</strong> {visit.client.contact_phone}
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-medium">{t("clientVisit.fullAddress", "Alamat Lengkap")}</h4>
          <p className="text-sm text-muted-foreground break-words">{address}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 w-full"
            onClick={() => void handleOpenGoogleMaps(visit)}
          >
            <Navigation className="h-4 w-4 mr-2" />
            {t("clientVisit.openGoogleMaps", "Google Maps")}
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-medium">{t("clientVisit.visitSchedule", "Jadwal Kunjungan")}</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div>
              <strong>{t("clientVisit.startTime", "Jam Mulai")}:</strong> {startTime}
            </div>
            <div>
              <strong>{t("clientVisit.endTime", "Jam Selesai")}:</strong> {endTime}
            </div>
            <div>
              <strong>Radius:</strong> {visit.validated_location?.radius_meters ?? "—"}m
            </div>
            <div>
              <strong>{t("reports.table.status", "Status")}:</strong> {t("clientVisit.scheduled", "terjadwal")}
            </div>
          </div>
        </div>

        {visit.visit_purpose ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h4 className="text-sm font-medium">{t("clientVisit.visitPurpose", "Tujuan Kunjungan")}</h4>
            <p className="text-sm text-muted-foreground break-words">{visit.visit_purpose}</p>
          </div>
        ) : null}

        {visit.notes ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h4 className="text-sm font-medium">{t("clientVisit.notes", "Catatan")}</h4>
            <p className="text-sm text-muted-foreground break-words">{visit.notes}</p>
          </div>
        ) : null}

        {!isMobile && visit.client?.contact_phone ? (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => handleCall(visit.client?.contact_phone || "")} className="flex-1">
              <Phone className="h-4 w-4 mr-2" />
              {t("clientVisit.call", "Telepon")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleWhatsApp(visit.client?.contact_phone || "", visit.client?.company_name || "")
              }
              className="flex-1"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        ) : null}
      </>
    );
  };

  if (unreadNotifications.length > 0) {
    // Reserved for future push/in-app notifications.
  }

  if (pendingVisits.length === 0) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-3 pt-1 pb-1.5 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium tracking-tight flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0">{sectionTitle}</span>
          </CardTitle>
          {headerAction ? <div className="shrink-0 self-end sm:self-auto">{headerAction}</div> : null}
        </CardHeader>
        <CardContent className="px-3 pt-1.5 pb-3">
          <div className="text-center py-4 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {t("clientVisit.noScheduledVisitsToday", "Tidak ada kunjungan terjadwal hari ini")}
            </p>
            <p className="text-xs mt-1">
              {t(
                "clientVisit.noScheduledVisitsTodayHint",
                "Daftar ini mengikuti data jadwal di client_visits. Anda masih bisa mulai kunjungan spontan.",
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-3 pt-1 pb-1.5 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base font-medium tracking-tight flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{sectionTitle}</span>
          <Badge variant="default" className="shrink-0 text-xs">
            {t("clientVisit.visitsCount", "{{count}} kunjungan", { count: pendingVisits.length })}
          </Badge>
        </CardTitle>
        {headerAction ? <div className="shrink-0 self-end sm:self-auto">{headerAction}</div> : null}
      </CardHeader>
      <CardContent className="space-y-2 px-3 pt-1.5 pb-3">
        {pendingVisits.map((visit) => {
          const scheduleTime = formatVisitPlannedTimeRange(
            visit,
            t("clientVisit.flexibleTime", "Waktu fleksibel"),
          );
          const address = getVisitSiteAddress(visit, t("clientVisit.addressNotSet", "Alamat belum diatur"));
          const companyName = visit.client?.company_name || t("clientVisit.clientNotSet", "Client Belum Diatur");

          return (
            <div
              key={visit.id}
              className="min-w-0 overflow-hidden border rounded-lg p-3 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-sm font-medium">{companyName}</span>
                    {visit.client?.contact_person && (
                      <p className="text-xs text-muted-foreground">
                        {t("clientVisit.contact", "Contact")}: {visit.client.contact_person}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-2">{truncateAddress(address)}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{scheduleTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Radius: {visit.validated_location?.radius_meters ?? "—"}m</span>
                </div>
              </div>

              <div className="min-w-0 space-y-2 pt-2 border-t border-border">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Select
                    value={priorities[visit.id] || "medium"}
                    onValueChange={(value) => handlePriorityChange(visit.id, value)}
                  >
                    <SelectTrigger className="w-24 h-7 shrink-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">{t("clientVisit.priorityHigh", "High")}</SelectItem>
                      <SelectItem value="medium">{t("clientVisit.priorityMedium", "Medium")}</SelectItem>
                      <SelectItem value="low">{t("clientVisit.priorityLow", "Low")}</SelectItem>
                    </SelectContent>
                  </Select>

                  {visit.client?.contact_phone && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCall(visit.client?.contact_phone || "")}
                        className="h-7 shrink-0 px-2 text-xs"
                      >
                        <Phone className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">{t("clientVisit.call", "Telepon")}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWhatsApp(visit.client?.contact_phone || "", companyName)}
                        className="h-7 shrink-0 px-2 text-xs"
                      >
                        <MessageCircle className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleOpenGoogleMaps(visit)}
                    className="h-7 shrink-0 px-2 text-xs"
                  >
                    <Navigation className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">{t("clientVisit.openGoogleMaps", "Google Maps")}</span>
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full shrink-0 justify-end px-0 text-xs sm:w-auto"
                  onClick={() => setDetailVisit(visit)}
                >
                  {t("clientVisit.detail", "Detail")}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={detailVisit != null} onOpenChange={(open) => !open && setDetailVisit(null)}>
        <DialogContent
          className={profileFullscreenDialogContentClass(isMobile)}
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          {detailVisit ? (
            <>
              <ProfileDetailModalHeader
                isMobile={isMobile}
                title={detailVisit.client?.company_name || t("clientVisit.locationDetail", "Detail Lokasi")}
                icon={MapPin}
                closeLabel={t("layout.sheetClose", "Close")}
                onClose={() => setDetailVisit(null)}
              />

              <div className={profileFullscreenScrollBodyClass()}>
                <div className="mx-auto w-full max-w-md space-y-1 pb-4">
                  {renderVisitDetailBody(detailVisit)}
                </div>
              </div>

              {isMobile && detailVisit ? (
                <div className="flex-shrink-0 space-y-2 border-t bg-muted/30 px-4 pt-3 pb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleOpenGoogleMaps(detailVisit)}
                    className="w-full"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    {t("clientVisit.openGoogleMaps", "Google Maps")}
                  </Button>
                  {detailVisit.client?.contact_phone ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCall(detailVisit.client?.contact_phone || "")}
                        className="flex-1"
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        {t("clientVisit.call", "Telepon")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleWhatsApp(
                            detailVisit.client?.contact_phone || "",
                            detailVisit.client?.company_name || "",
                          )
                        }
                        className="flex-1"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
