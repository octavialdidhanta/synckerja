import { Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import type { WorkSchedule, ScheduleDay } from "@/mobile/hooks/useWorkSchedule";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { LANGUAGE_STORAGE_KEY } from "@/features/share/i18n/translations";

export interface OfficeScheduleCardProps {
  workSchedule: WorkSchedule | null;
  scheduleData: ScheduleDay[];
  loading: boolean;
  error: string | null;
  refetch?: () => void;
}

export const OfficeScheduleCard = ({ workSchedule, scheduleData, loading, error }: OfficeScheduleCardProps) => {
  const { t, language } = useAppTranslation();
  const storedLang = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
  const useId = (storedLang === "id" || storedLang === "en" ? storedLang : language) === "id";
  const th = (idLabel: string, enLabel: string) => (useId ? idLabel : enLabel);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-primary/10 border-primary text-primary';
      case 'upcoming':
        return 'bg-muted border-border text-muted-foreground';
      case 'completed':
        return 'bg-success/10 border-success/30 text-success';
      case 'holiday':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'off':
        return 'bg-muted border-border text-muted-foreground';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return th("Aktif", "Active");
      case "upcoming":
        return th("Nanti", "Upcoming");
      case "completed":
        return th("Selesai", "Completed");
      case "holiday":
        return th("Libur", "Off");
      case "off":
        return th("Libur", "Off");
      default:
        return "";
    }
  };
  if (loading) {
    return <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        
        <div className="overflow-hidden">
          {/* Header Skeleton */}
          <div className="grid grid-cols-5 bg-primary text-primary-foreground p-3 text-xs font-medium">
            <div>{th("Hari", "Day")}</div>
            <div>{th("Tanggal", "Date")}</div>
            <div>{th("Masuk", "In")}</div>
            <div>{th("Pulang", "Out")}</div>
            <div>{t("schedule.officeTable.status", "Status")}</div>
          </div>
          
          {/* Schedule Items Skeleton */}
          <div className="max-h-64">
            {Array.from({
            length: 7
          }).map((_, index) => <div key={index} className="grid grid-cols-5 p-3 border-b border-border text-xs">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>)}
          </div>
        </div>
        
        {/* Footer Skeleton */}
        <div className="p-3 bg-muted/30 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="mt-1">
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>;
  }
  if (error || !workSchedule) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">{t("schedule.notConfigured", "Jadwal Kerja Belum Dikonfigurasi")}</p>
            <p className="text-xs text-muted-foreground">{t("schedule.contactAdmin", "Silakan hubungi administrator untuk mengatur jadwal kerja")}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">{t("schedule.regularScheduleTitle", "Jadwal Reguler Senin - Minggu")}</h2>
        </div>
      </div>
      
      <div className="overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-5 bg-primary text-primary-foreground p-3 text-xs font-medium">
          <div>{th("Hari", "Day")}</div>
          <div>{th("Tanggal", "Date")}</div>
          <div>{th("Masuk", "In")}</div>
          <div>{th("Pulang", "Out")}</div>
          <div>{t("schedule.officeTable.status", "Status")}</div>
        </div>
        
        {/* Schedule Items */}
        <div className="max-h-64 overflow-y-auto">
          {scheduleData.map((item, index) => (
            <div
              key={index}
              className={`grid grid-cols-5 p-3 border-b border-border text-xs ${
                item.status === 'active'
                  ? 'bg-primary/5'
                  : item.status === 'holiday'
                    ? 'bg-destructive/5'
                    : ''
              }`}
            >
              <div
                className={`font-medium ${item.isWorkingDay ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {item.day}
              </div>
              <div className="text-muted-foreground">{item.date}</div>
              <div className={`${item.isWorkingDay ? 'text-foreground' : 'text-muted-foreground'}`}>
                {item.startTime}
              </div>
              <div className={`${item.isWorkingDay ? 'text-foreground' : 'text-muted-foreground'}`}>
                {item.endTime}
              </div>
              <div>
                <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(item.status)}`}>
                  {getStatusLabel(item.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Schedule Info */}
      <div className="p-3 bg-muted/30 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("schedule.timezone", "Timezone: {{value}}", { value: workSchedule.timezone })}</span>
          </div>
          {workSchedule.break_start_time && workSchedule.break_end_time && (
            <span className="text-xs text-muted-foreground">
              {t("schedule.breakLabel", "Istirahat: {{start}} - {{end}}", {
                start: workSchedule.break_start_time?.slice(0, 5),
                end: workSchedule.break_end_time?.slice(0, 5),
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};