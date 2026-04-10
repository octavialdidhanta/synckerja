import { Card } from "@/mobile/components/ui/card";
import { ScrollArea } from "@/mobile/components/ui/scroll-area";
import { format } from "date-fns";
import { id, enUS } from "date-fns/locale";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  is_late: boolean;
  late_minutes: number;
  working_hours_minutes: number;
  penalties: {
    penalty_amount: number;
    penalty_reason: string;
    status: string;
  }[];
}

interface AttendanceHistoryTableProps {
  attendanceHistory: AttendanceRecord[];
  loading: boolean;
  error: string | null;
}

export const AttendanceHistoryTable = ({
  attendanceHistory,
  loading,
  error
}: AttendanceHistoryTableProps) => {
  const { t, language } = useAppTranslation();
  const locale = language === "id" ? id : enUS;

  const formatTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return "-";
    return format(new Date(dateTimeString), "HH:mm");
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM", { locale });
  };

  const getStatusKey = (record: AttendanceRecord): "absent" | "late" | "earlyLeave" | "present" => {
    if (!record.check_in_time) return "absent";
    if (record.is_late) return "late";
    if (record.status === "early_leave") return "earlyLeave";
    return "present";
  };

  const getStatusText = (record: AttendanceRecord) => {
    const key = getStatusKey(record);
    return t(`reports.status.${key}` as const, key === "absent" ? "Tidak Hadir" : key === "late" ? "Terlambat" : key === "earlyLeave" ? "Pulang Awal" : "Hadir");
  };

  const getTotalPenalty = (penalties: AttendanceRecord['penalties']) => {
    if (!penalties || penalties.length === 0) return "•";
    const total = penalties.reduce((sum, penalty) => sum + (penalty.penalty_amount || 0), 0);
    return `Rp ${Math.round(total).toLocaleString('id-ID')}`;
  };

  return (
    <Card className="bg-gradient-card border border-border">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{t("reports.historyAttendance", "History Absensi")}</h3>
      </div>
      
      <div className="p-3">
        <div className="w-full overflow-x-auto">
          <div className="flex text-xs font-medium text-muted-foreground mb-2 pb-2 border-b border-border gap-2">
            <div className="flex-shrink-0" style={{ flexBasis: "12%" }}>{t("reports.table.date", "Tanggal")}</div>
            <div className="flex-shrink-0" style={{ flexBasis: "10%" }}>{t("reports.table.in", "Masuk")}</div>
            <div className="flex-shrink-0" style={{ flexBasis: "10%" }}>{t("reports.table.out", "Pulang")}</div>
            <div className="flex-shrink-0" style={{ flexBasis: "18%" }}>{t("reports.table.status", "Status")}</div>
            <div className="flex-shrink-0 text-center" style={{ flexBasis: "12%" }}>{t("reports.table.min", "Min")}</div>
            <div className="flex-shrink-0 text-right pr-1" style={{ flexBasis: "90px" }}>
              {t("reports.table.penalty", "Penalty")}
            </div>
          </div>
          
          <ScrollArea className="h-48">
            <div className="w-full">
              {loading ? (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">{t("reports.loadingData", "Memuat data...")}</div>
                </div>
              ) : error ? (
                <div className="text-center py-4">
                  <div className="text-sm text-destructive">{t("profile.error", "Error")}: {error}</div>
                </div>
              ) : attendanceHistory.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">{t("reports.noDataForPeriod", "Belum ada data absensi untuk periode ini")}</div>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {attendanceHistory.map(record => {
                const status = getStatusText(record);
                const penalty = getTotalPenalty(record.penalties);
                const lateMinutes = record.is_late && record.late_minutes ? `${record.late_minutes}m` : "-";
                return <div key={record.id} className="flex text-xs border-b border-border/50 last:border-b-0 items-center gap-2 py-0">
                        <div className="flex-shrink-0 text-foreground truncate" style={{
                    flexBasis: '12%'
                  }} title={formatDate(record.attendance_date)}>
                          {formatDate(record.attendance_date)}
                        </div>
                        <div className="flex-shrink-0 text-foreground truncate" style={{
                    flexBasis: '10%'
                  }} title={formatTime(record.check_in_time)}>
                          {formatTime(record.check_in_time)}
                        </div>
                        <div className="flex-shrink-0 text-foreground truncate" style={{
                    flexBasis: '10%'
                  }} title={formatTime(record.check_out_time)}>
                          {formatTime(record.check_out_time)}
                        </div>
                        <div className="flex-shrink-0" style={{
                    flexBasis: '18%'
                  }}>
                          <div className={`text-xs px-1.5 py-0.5 rounded text-center inline-block max-w-full truncate ${getStatusKey(record) === "present" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : getStatusKey(record) === "late" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" : getStatusKey(record) === "earlyLeave" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`} title={status}>
                            {status}
                          </div>
                        </div>
                        <div className={`flex-shrink-0 font-medium text-center ${lateMinutes === "-" ? "text-muted-foreground" : "text-warning"}`} style={{
                    flexBasis: '12%'
                  }} title={lateMinutes}>
                          {lateMinutes}
                        </div>
                        <div
                          className={`flex-shrink-0 font-semibold ${penalty === "•" ? "text-muted-foreground" : "text-destructive"} text-right`}
                          style={{ flexBasis: "90px" }}
                        >
                          {penalty}
                        </div>
                      </div>;
              })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
};
