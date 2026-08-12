import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Plus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { getCalendarPlanCardTone } from "@/6-1-content-calendar/utils/calendarPlanCardTone";

type PlanLike = {
  id?: string;
  title?: string | null;
  approved?: boolean;
  production_approved?: boolean;
  done?: boolean;
  production_status?: string | null;
  service?: { name?: string | null } | null;
  sub_service?: { name?: string | null } | null;
  content_pillar?: { name?: string | null } | null;
  pic?: { full_name?: string | null } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  plans: PlanLike[];
  onSelectPlan: (plan: PlanLike) => void;
  onAddContent?: (date: Date) => void;
};

function toneBarClass(tone: ReturnType<typeof getCalendarPlanCardTone>) {
  switch (tone) {
    case "red":
      return "bg-red-500";
    case "orange":
      return "bg-orange-500";
    case "yellow":
      return "bg-amber-400";
    case "green":
      return "bg-green-500";
    case "prod-need-review":
      return "bg-gray-500";
    case "prod-request-revision":
      return "bg-red-800";
    default:
      return "bg-blue-500";
  }
}

function picName(plan: PlanLike) {
  return plan.pic?.full_name || "Unassigned";
}

/**
 * Step 1: pick a content plan for the day before opening Storyline/Storyboard.
 */
export function MobileDayPlanPickerSheet({
  open,
  onOpenChange,
  selectedDate,
  plans,
  onSelectPlan,
  onAddContent,
}: Props) {
  const { t } = useAppTranslation();
  const dateLabel = selectedDate
    ? format(selectedDate, "dd MMMM yyyy", { locale: id })
    : "";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] px-0 pb-4">
        <DrawerHeader className="px-4 pb-2 text-left">
          <DrawerTitle className="text-base">
            {t("contentCalendar.mobile.dayPlansTitle", "Content Plans")}
            {dateLabel ? ` — ${dateLabel}` : ""}
          </DrawerTitle>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {plans.length === 1
                ? t("contentCalendar.mobile.onePlan", "1 Content Plan")
                : `${plans.length} ${t("contentCalendar.mobile.plans", "Content Plans")}`}
            </p>
            {selectedDate && onAddContent ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => onAddContent(selectedDate)}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("contentCalendar.dayDialog.addContent", "Add Content")}
              </Button>
            ) : null}
          </div>
        </DrawerHeader>

        <div className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto px-4 pb-2">
          {plans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t(
                  "contentCalendar.mobile.noPlans",
                  "No content plans for this day.",
                )}
              </p>
              {selectedDate && onAddContent ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 gap-1"
                  onClick={() => onAddContent(selectedDate)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("contentCalendar.dayDialog.addContent", "Add Content")}
                </Button>
              ) : null}
            </div>
          ) : (
            plans.map((plan) => {
              const tone = getCalendarPlanCardTone(plan);
              const meta = [
                plan.service?.name,
                plan.sub_service?.name,
                plan.content_pillar?.name,
              ]
                .filter(Boolean)
                .join(" - ");
              return (
                <button
                  key={plan.id ?? plan.title ?? Math.random()}
                  type="button"
                  onClick={() => onSelectPlan(plan)}
                  className={cn(
                    "flex w-full items-stretch gap-0 overflow-hidden rounded-lg border border-border bg-card text-left transition-colors",
                    "hover:bg-muted/60 active:bg-muted",
                  )}
                >
                  <span
                    className={cn("w-1.5 shrink-0", toneBarClass(tone))}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 space-y-0.5 px-3 py-2.5">
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {meta || t("contentCalendar.mobile.noService", "No Service")}
                    </span>
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {plan.title?.trim() || t("contentCalendar.mobile.untitled", "Untitled")}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {picName(plan)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
