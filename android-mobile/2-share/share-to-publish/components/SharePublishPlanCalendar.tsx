import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/mobile-app/components/ui/button";
import { CalendarGrid } from "@/6-1-content-calendar/container/CalendarGrid";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";

type Props = {
  plans: ShareableSocialMediaPlan[];
  selectedPlanId: string | null;
  onSelect: (plan: ShareableSocialMediaPlan) => void;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isoDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parsePlanDate(value: string | null | undefined) {
  if (!value) return null;
  const sliced = value.slice(0, 10);
  const [year, month, day] = sliced.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function buildCalendarDays(visibleMonth: Date) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = firstDay.getDay();
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  for (let index = leadingDays - 1; index >= 0; index -= 1) {
    calendarDays.push({
      date: new Date(year, month, -index),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    calendarDays.push({
      date: new Date(year, month, day),
      isCurrentMonth: true,
    });
  }

  const trailingDays = 42 - calendarDays.length;
  for (let day = 1; day <= trailingDays; day += 1) {
    calendarDays.push({
      date: new Date(year, month + 1, day),
      isCurrentMonth: false,
    });
  }

  return calendarDays;
}

export function SharePublishPlanCalendar({ plans, selectedPlanId, onSelect }: Props) {
  const { t } = useAppTranslation();

  const initialMonth = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
    return startOfMonth(parsePlanDate(selectedPlan?.post_date) ?? parsePlanDate(plans[0]?.post_date) ?? new Date());
  }, [plans, selectedPlanId]);

  const [visibleMonth, setVisibleMonth] = useState(initialMonth);

  useEffect(() => {
    setVisibleMonth(initialMonth);
  }, [initialMonth]);

  const plansByDate = useMemo(() => {
    const grouped = new Map<string, ShareableSocialMediaPlan[]>();

    for (const plan of plans) {
      const key = plan.post_date?.slice(0, 10);
      if (!key) continue;
      const current = grouped.get(key) ?? [];
      current.push(plan);
      grouped.set(key, current);
    }

    for (const [key, groupedPlans] of grouped) {
      grouped.set(
        key,
        [...groupedPlans].sort((a, b) => {
          if (a.id === selectedPlanId) return -1;
          if (b.id === selectedPlanId) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
      );
    }

    return grouped;
  }, [plans, selectedPlanId]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(visibleMonth),
    [visibleMonth],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold capitalize text-foreground">{monthLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("share.publish.calendar.hint", "Tap a card to choose a plan")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <CalendarGrid
        variant="share-picker"
        calendarDays={calendarDays}
        getDayInfo={(date) => {
          const dayPlans = plansByDate.get(isoDateOnly(date)) ?? [];
          return {
            count: dayPlans.length,
            plans: dayPlans,
          };
        }}
        onDayClick={(date, dayInfo) => {
          const targetDate = startOfMonth(date);
          if (
            targetDate.getFullYear() !== visibleMonth.getFullYear() ||
            targetDate.getMonth() !== visibleMonth.getMonth()
          ) {
            setVisibleMonth(targetDate);
            return;
          }
          if (dayInfo?.plans?.length === 1) {
            onSelect(dayInfo.plans[0] as ShareableSocialMediaPlan);
          }
        }}
        onPlanClick={(_, plan) => onSelect(plan as ShareableSocialMediaPlan)}
        isPlanSelected={(plan) => plan?.id === selectedPlanId}
      />
    </div>
  );
}
