import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

const indonesianMonths = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type Props = {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  className?: string;
};

/**
 * Compact month nav (no card/pill wrapper). Service filter lives in header icon + drawer.
 */
export function MobileContentCalendarFilterStrip({
  currentDate,
  onPrevMonth,
  onNextMonth,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const monthLabel = `${indonesianMonths[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  return (
    <div className={cn("flex items-center justify-center gap-0.5 py-0", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onPrevMonth}
        aria-label={t("contentCalendar.nav.prevMonth", "Previous month")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[7rem] text-center text-xs font-medium leading-none text-foreground">
        {monthLabel}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onNextMonth}
        aria-label={t("contentCalendar.nav.nextMonth", "Next month")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
