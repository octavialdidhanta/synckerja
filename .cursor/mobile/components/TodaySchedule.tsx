import { Clock, Users, MapPin } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface TodayScheduleProps {
  schedule: {
    startTime: string;
    endTime: string;
    location: string;
    department: string;
    notes?: string;
    isWorkingDay?: boolean;
    isHoliday?: boolean;
    holidayName?: string | null;
  };
}

export const TodaySchedule = ({ schedule }: TodayScheduleProps) => {
  const { t } = useAppTranslation();

  /** Returns true only when today is a working day and current time is within work hours. */
  const isCurrentlyWorkTime = (): boolean => {
    if (schedule.isHoliday || schedule.isWorkingDay === false) return false;
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = schedule.startTime.split(":").map(Number);
    const [endHour, endMin] = schedule.endTime.split(":").map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    return currentTime >= startTime && currentTime <= endTime;
  };

  const getTimeStatus = () => {
    if (schedule.isHoliday) {
      return {
        status: "holiday",
        message: schedule.holidayName
          ? t("mobileHome.holidayToday", `Hari libur: ${schedule.holidayName}`, { name: schedule.holidayName })
          : t("mobileHome.todayOff", "Hari ini libur"),
      };
    }
    if (schedule.isWorkingDay === false) {
      return {
        status: "off",
        message: t("mobileHome.noScheduleToday", "Tidak ada jadwal kerja untuk hari ini"),
      };
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = schedule.startTime.split(":").map(Number);
    const startTime = startHour * 60 + startMin;

    if (currentTime < startTime) {
      const diff = startTime - currentTime;
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      return {
        status: "upcoming",
        message: t("mobileHome.workStartedIn", "Jam kerja dimulai dalam {{duration}}", { duration }),
      };
    }
    if (isCurrentlyWorkTime()) {
      return {
        status: "active",
        message: t("mobileHome.currentlyWorking", "Sedang dalam jam kerja"),
      };
    }
    return {
      status: "completed",
      message: t("mobileHome.workEnded", "Jam kerja telah selesai"),
    };
  };

  const timeStatus = getTimeStatus();

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{t("mobileHome.todaySchedule", "Jadwal Hari Ini")}</h3>
      </div>

      {/* Schedule Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("mobileHome.workHours", "Jam Kerja")}</span>
          <span className="text-sm font-medium text-foreground">
            {timeStatus.status === "holiday" || timeStatus.status === "off"
              ? "-"
              : `${schedule.startTime} - ${schedule.endTime}`}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("mobileHome.location", "Lokasi")}</span>
          <div className="flex items-center gap-1 text-right">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground text-right">{schedule.location}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("mobileHome.department", "Departemen")}</span>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{schedule.department}</span>
          </div>
        </div>

        {schedule.notes && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {schedule.notes === "Hari kerja sesuai jadwal"
                ? t("mobileHome.workingDayPerSchedule", "Hari kerja sesuai jadwal")
                : schedule.notes === "Hari ini libur"
                  ? t("mobileHome.todayOff", "Hari ini libur")
                  : schedule.notes === "Jadwal kerja default"
                    ? t("mobileHome.defaultSchedule", "Jadwal kerja default")
                    : schedule.notes.startsWith("Hari libur: ") && schedule.holidayName
                      ? t("mobileHome.holidayToday", "Hari libur: {{name}}", { name: schedule.holidayName })
                      : schedule.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};