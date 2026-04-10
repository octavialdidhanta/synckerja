import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Badge } from "@/mobile/components/ui/badge";
import { Button } from "@/mobile/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/mobile/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/mobile/components/ui/select";
import { Bell, Clock, MapPin, User, Phone, MessageCircle, ChevronRight } from "lucide-react";
import { useClientLocations } from "@/mobile/hooks/useClientLocations";
import { useState } from "react";
import { toast } from "@/features/ui/use-toast";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
interface VisitNotification {
  id: string;
  title: string;
  message: string;
  notification_type: 'reminder' | 'overdue' | 'completed';
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
  /** Optional node to render in the header (e.g. period filter). */
  headerAction?: React.ReactNode;
}
export const VisitNotifications = ({
  notifications = [],
  onMarkAsRead,
  headerAction,
}: VisitNotificationsProps) => {
  const { t } = useAppTranslation();
  const {
    clientLocations,
    loading,
    error
  } = useClientLocations();
  const unreadNotifications = notifications.filter(n => !n.is_read);
  const [priorities, setPriorities] = useState<Record<string, string>>({});
  const handlePriorityChange = (locationId: string, priority: string) => {
    setPriorities(prev => ({
      ...prev,
      [locationId]: priority
    }));
    toast({
      title: t("clientVisit.priorityUpdated", "Prioritas Updated"),
      description: t("clientVisit.priorityUpdatedDesc", "Prioritas visit berhasil diubah ke {{priority}}", { priority })
    });
  };
  const handleWhatsApp = (phone: string, companyName: string) => {
    if (!phone) {
      toast({
        title: t("clientVisit.phoneNotAvailable", "Nomor HP tidak tersedia"),
        variant: "destructive"
      });
      return;
    }
    const message = `Halo, saya ingin mengatur jadwal kunjungan ke ${companyName}`;
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  const handleCall = (phone: string) => {
    if (!phone) {
      toast({
        title: t("clientVisit.phoneNotAvailable", "Nomor HP tidak tersedia"),
        variant: "destructive"
      });
      return;
    }
    window.open(`tel:${phone}`, '_self');
  };
  const truncateAddress = (address: string, maxLength: number = 50) => {
    if (!address) return t("clientVisit.addressNotSet", "Alamat belum diatur");
    return address.length > maxLength ? `${address.substring(0, maxLength)}...` : address;
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-warning text-warning-foreground';
      case 'low':
        return 'bg-success text-success-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="px-3 pt-1 pb-1.5 border-b border-border flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base font-medium tracking-tight">
            {t("clientVisit.notificationsTitle", "Notifikasi Kunjungan")}
          </CardTitle>
          {headerAction}
        </CardHeader>
        <CardContent className="px-3 pt-1.5 pb-3">
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (clientLocations.length === 0 && !error) {
    return (
      <Card>
        <CardHeader className="px-3 pt-1 pb-1.5 border-b border-border flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base font-medium tracking-tight">
            {t("clientVisit.notificationsTitle", "Notifikasi Kunjungan")}
          </CardTitle>
          {headerAction}
        </CardHeader>
        <CardContent className="px-3 pt-1.5 pb-3">
          <div className="text-center py-4 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t("clientVisit.noNotifications", "Tidak ada notifikasi")}</p>
            <p className="text-xs mt-1">{t("clientVisit.notificationsHint", "Notifikasi pengingat akan muncul di sini")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="px-3 pt-1 pb-1.5 border-b border-border flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-medium tracking-tight flex items-center gap-2 shrink-0">
          <span>{t("clientVisit.notificationsTitle", "Notifikasi Kunjungan")}</span>
          {clientLocations.length > 0 && (
            <Badge variant="default" className="text-xs">
              {t("clientVisit.locationsCount", "{{count}} lokasi", { count: clientLocations.length })}
            </Badge>
          )}
        </CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent className="px-3 pt-1.5 pb-3 space-y-2">
        {error && (
          <div className="text-center py-4 text-destructive">
            <p className="text-sm">{t("profile.error", "Error")}: {error}</p>
          </div>
        )}
        
        {clientLocations.map(location => <div key={location.id} className="border rounded-lg p-3 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
            {/* Header with company name and priority */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-sm font-medium">{location.clients?.company_name || t("clientVisit.clientNotSet", "Client Belum Diatur")}</span>
                  {location.clients?.contact_person && <p className="text-xs text-muted-foreground">{t("clientVisit.contact", "Contact")}: {location.clients.contact_person}</p>}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                
              </div>
            </div>

            {/* Address (truncated) */}
            <p className="text-sm text-muted-foreground mb-2">
              {truncateAddress(location.address || t("clientVisit.addressNotSet", "Alamat belum diatur"))}
            </p>

            {/* Time schedule info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{location.planned_start_time?.slice(0, 5) || '08:00'} - {location.planned_end_time?.slice(0, 5) || '17:00'}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Radius: {location.radius_meters}m</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex gap-2 items-center">
                <Select value={priorities[location.id] || "medium"} onValueChange={(value) => handlePriorityChange(location.id, value)}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{t("clientVisit.priorityHigh", "High")}</SelectItem>
                    <SelectItem value="medium">{t("clientVisit.priorityMedium", "Medium")}</SelectItem>
                    <SelectItem value="low">{t("clientVisit.priorityLow", "Low")}</SelectItem>
                  </SelectContent>
                </Select>
                
                {location.clients?.contact_phone && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleCall(location.clients?.contact_phone || "")} className="h-7 text-xs">
                      <Phone className="h-3 w-3 mr-1" />
                      {t("clientVisit.call", "Telepon")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleWhatsApp(location.clients?.contact_phone || "", location.clients?.company_name || "")} className="h-7 text-xs">
                      <MessageCircle className="h-3 w-3 mr-1" />
                      WhatsApp
                    </Button>
                  </>
                )}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">
                    {t("clientVisit.detail", "Detail")}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {location.clients?.company_name || t("clientVisit.locationDetail", "Detail Lokasi")}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{t("clientVisit.clientInfo", "Informasi Client")}</h4>
                      {location.clients?.contact_person && (
                        <p className="text-sm text-muted-foreground">
                          <strong>{t("clientVisit.contactPerson", "Contact Person")}:</strong> {location.clients.contact_person}
                        </p>
                      )}
                      {location.clients?.contact_phone && (
                        <p className="text-sm text-muted-foreground">
                          <strong>{t("clientVisit.phone", "Phone")}:</strong> {location.clients.contact_phone}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{t("clientVisit.fullAddress", "Alamat Lengkap")}</h4>
                      <p className="text-sm text-muted-foreground">
                        {location.address || t("clientVisit.addressNotSet", "Alamat belum diatur")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{t("clientVisit.visitSchedule", "Jadwal Kunjungan")}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <strong>{t("clientVisit.startTime", "Jam Mulai")}:</strong> {location.planned_start_time?.slice(0, 5) || "08:00"}
                        </div>
                        <div>
                          <strong>{t("clientVisit.endTime", "Jam Selesai")}:</strong> {location.planned_end_time?.slice(0, 5) || "17:00"}
                        </div>
                        <div>
                          <strong>Radius:</strong> {location.radius_meters}m
                        </div>
                        <div>
                          <strong>{t("reports.table.status", "Status")}:</strong> {t("clientVisit.statusActive", "Aktif")}
                        </div>
                      </div>
                    </div>

                    {location.notes && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">{t("clientVisit.notes", "Catatan")}</h4>
                        <p className="text-sm text-muted-foreground">{location.notes}</p>
                      </div>
                    )}

                    {location.clients?.contact_phone && (
                      <div className="flex gap-2 pt-4 border-t">
                        <Button onClick={() => handleCall(location.clients?.contact_phone || "")} className="flex-1">
                          <Phone className="h-4 w-4 mr-2" />
                          {t("clientVisit.call", "Telepon")}
                        </Button>
                        <Button variant="outline" onClick={() => handleWhatsApp(location.clients?.contact_phone || "", location.clients?.company_name || "")} className="flex-1">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};