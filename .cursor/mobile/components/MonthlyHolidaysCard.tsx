import { Calendar, Coffee } from "lucide-react";
import { Card } from "@/mobile/components/ui/card";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { useNationalHolidays } from "@/mobile/hooks/useNationalHolidays";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { format } from "date-fns";
import { id, enUS } from "date-fns/locale";

export const MonthlyHolidaysCard = () => {
  const { t, language } = useAppTranslation();
  const { holidays, loading, error } = useNationalHolidays();
  const locale = language === "id" ? id : enUS;

  const formatHolidayDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd MMM", { locale });
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    return format(now, "MMMM yyyy", { locale });
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-card border border-border">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
              <Skeleton className="w-8 h-8 rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-gradient-card border border-border">
        <div className="flex items-center gap-3 mb-3">
          <Coffee className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t("schedule.holidaysTitle", "Hari Libur {{monthYear}}", { monthYear: getCurrentMonthYear() })}</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-destructive">{t("schedule.holidaysLoadError", "Gagal memuat data libur")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-card border border-border">
      <div className="flex items-center gap-3 mb-3">
        <Coffee className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{t("schedule.holidaysTitle", "Hari Libur {{monthYear}}", { monthYear: getCurrentMonthYear() })}</h3>
      </div>
      
      {holidays.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">{t("schedule.noHolidaysThisMonth", "Tidak ada hari libur bulan ini")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {holidays.map(holiday => (
            <div key={holiday.id} className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
              <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h4 className="font-medium text-foreground text-sm leading-tight">
                    {holiday.name}
                  </h4>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {formatHolidayDate(holiday.date)}
                    </span>
                    {holiday.is_recurring && (
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {t("schedule.recurringHoliday", "Libur Tahunan")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
