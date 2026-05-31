import { Link } from "react-router-dom";
import { Calendar, MapPin, ExternalLink, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { useOfficeLocations } from "@/features/2-3-settings/hooks/useLocationManagement";
import { useReportAttendanceSettingsLoading } from "@/2-3-attendance/context/AttendancePageLoadContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const JADWAL_KUNJUNGAN_PATH = "/operations/sales/jadwal-kunjungan";
const CLIENT_VISITS_PATH = "/operations/sales/client-visits";

export const VisitScheduling = () => {
  const { t } = useAppTranslation();
  const { locations, loading: locationsLoading } = useOfficeLocations();
  useReportAttendanceSettingsLoading(locationsLoading);

  const clientSiteCount = locations.filter(
    (loc) => (loc as { is_client_location?: boolean }).is_client_location === true,
  ).length;

  if (locationsLoading) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 shrink-0" />
            {t("attendanceSettings.visitScheduling.title", "Visit Scheduling")}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {t(
              "attendanceSettings.visitScheduling.redirectDescription",
              "Jadwal kunjungan client dikelola di modul Sales Operations, bukan di halaman Attendance Settings.",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">
            {t(
              "attendanceSettings.visitScheduling.redirectHint",
              "Buat jadwal baru, lihat status kunjungan, dan kelola lokasi client site dari halaman Jadwal Kunjungan.",
            )}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild className="gap-2">
              <Link to={JADWAL_KUNJUNGAN_PATH}>
                <ExternalLink className="h-4 w-4" />
                {t("attendanceSettings.visitScheduling.openJadwal", "Buka Jadwal Kunjungan")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to={CLIENT_VISITS_PATH}>
                <ClipboardList className="h-4 w-4" />
                {t("attendanceSettings.visitScheduling.openClientVisits", "Lihat Client Visits")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-muted">
            <MapPin className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("attendanceSettings.visitScheduling.activeClientSites", "Lokasi client site aktif")}
            </p>
            <p className="text-2xl font-bold tabular-nums">{clientSiteCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
