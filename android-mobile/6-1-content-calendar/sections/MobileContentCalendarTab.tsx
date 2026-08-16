import { CalendarGrid } from "@/6-1-content-calendar/container/CalendarGrid";
import { CalendarStats } from "@/6-1-content-calendar/container/CalendarStats";

interface MonthlyStats {
  total: number;
  red: number;
  orange: number;
  yellow: number;
  green: number;
  greenWithLate: number;
}

interface MobileContentCalendarTabProps {
  monthlyStats: MonthlyStats;
  calendarDays: Array<{ date: Date; isCurrentMonth: boolean }>;
  getDayInfo: (date: Date) => any;
  onDayClick: (date: Date, dayInfo?: any) => void;
  onPlanClick: (date: Date, plan: any) => void;
  onPlanPrefetch?: (plan: any) => void;
  onOpenPreview: (plan: any) => void;
}

export function MobileContentCalendarTab({
  monthlyStats,
  calendarDays,
  getDayInfo,
  onDayClick,
  onPlanClick,
  onPlanPrefetch,
  onOpenPreview,
}: MobileContentCalendarTabProps) {
  return (
    <>
      <div className="-mx-2 border-y border-border bg-card px-2 py-2 [&>div]:grid-cols-2 [&>div]:gap-1.5 [&>div>div]:p-3 [&>div>div]:rounded-none [&>div>div]:border-0">
        <CalendarStats monthlyStats={monthlyStats} />
      </div>

      <div className="-mx-2 border-y border-border bg-card px-0 py-2">
        <CalendarGrid
          calendarDays={calendarDays}
          getDayInfo={getDayInfo}
          onDayClick={onDayClick}
          onPlanClick={onPlanClick}
          onPlanPrefetch={onPlanPrefetch}
          onOpenPreview={onOpenPreview}
          layout="mobile-h-scroll"
        />
      </div>
    </>
  );
}
