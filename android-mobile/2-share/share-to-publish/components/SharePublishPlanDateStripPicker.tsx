import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/mobile-app/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { getCalendarPlanCardTone } from "@/6-1-content-calendar/utils/calendarPlanCardTone";
import { formatDate } from "@/shared/utils/dateFormatter";
import type { ShareableSocialMediaPlan } from "../lib/buildSharePlanQuery";

type Props = {
  plans: ShareableSocialMediaPlan[];
  selectedPlanId: string | null;
  /** Plan IDs whose publish results are OK — force green "uploaded" card tone. */
  uploadedPlanIds?: string[];
  onSelect: (plan: ShareableSocialMediaPlan) => void;
  onCreatePlan?: (postDate: string) => void;
  createDisabled?: boolean;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function parsePlanDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function isoDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cardToneClass(plan: ShareableSocialMediaPlan, forceUploaded: boolean) {
  if (forceUploaded) return "border-emerald-300 bg-emerald-50";
  switch (getCalendarPlanCardTone(plan)) {
    case "green":
      return "border-emerald-300 bg-emerald-50";
    case "yellow":
      return "border-amber-300 bg-amber-50";
    case "orange":
      return "border-orange-300 bg-orange-50";
    case "red":
      return "border-red-300 bg-red-50";
    case "prod-need-review":
      return "border-slate-300 bg-slate-100";
    case "prod-request-revision":
      return "border-rose-400 bg-rose-50";
    default:
      return "border-border/70 bg-white";
  }
}

function statusLabel(
  plan: ShareableSocialMediaPlan,
  t: ReturnType<typeof useAppTranslation>["t"],
  forceUploaded: boolean,
) {
  if (forceUploaded) {
    return t("share.publish.picker.status.uploaded", "Uploaded");
  }
  const tone = getCalendarPlanCardTone(plan);
  switch (tone) {
    case "green":
      return t("share.publish.picker.status.completed", "Completed");
    case "yellow":
      return t("share.publish.picker.status.readyProduction", "Ready to publish");
    case "orange":
      return t("share.publish.picker.status.inProduction", "In production");
    case "red":
      return t("share.publish.picker.status.needApproval", "Need approval");
    case "prod-need-review":
      return t("share.publish.picker.status.needReview", "Need review");
    case "prod-request-revision":
      return t("share.publish.picker.status.revision", "Request revision");
    default:
      return t("share.publish.picker.status.draft", "Draft");
  }
}

function buildMonthDates(visibleMonth: Date) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
}

export function SharePublishPlanDateStripPicker({
  plans,
  selectedPlanId,
  uploadedPlanIds = [],
  onSelect,
  onCreatePlan,
  createDisabled = false,
}: Props) {
  const { t } = useAppTranslation();
  const uploadedSet = useMemo(() => new Set(uploadedPlanIds), [uploadedPlanIds]);
  const stripScrollRef = useRef<HTMLDivElement>(null);
  const todayKey = useMemo(() => isoDateOnly(new Date()), []);

  const selectedPlanDate = useMemo(() => {
    if (!selectedPlanId) return null;
    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
    return parsePlanDate(selectedPlan?.post_date);
  }, [plans, selectedPlanId]);

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => isoDateOnly(new Date()));
  const [userPickedDate, setUserPickedDate] = useState(false);

  // When a plan is selected, follow its post_date unless the user is browsing dates manually
  // for create (userPickedDate). Selecting a plan card clears the manual lock.
  useEffect(() => {
    if (!selectedPlanDate) return;
    if (userPickedDate && isoDateOnly(selectedPlanDate) !== selectedDate) return;
    const nextDate = isoDateOnly(selectedPlanDate);
    setVisibleMonth(startOfMonth(selectedPlanDate));
    setSelectedDate(nextDate);
  }, [selectedPlanDate, userPickedDate, selectedDate]);

  // Reset manual-pick lock when org plans list changes radically (e.g. org switch → empty selection).
  useEffect(() => {
    if (!selectedPlanId) {
      setUserPickedDate(false);
    }
  }, [selectedPlanId]);

  const plansByDate = useMemo(() => {
    const grouped = new Map<string, ShareableSocialMediaPlan[]>();

    for (const plan of plans) {
      const dateKey = plan.post_date?.slice(0, 10);
      if (!dateKey) continue;
      const current = grouped.get(dateKey) ?? [];
      current.push(plan);
      grouped.set(dateKey, current);
    }

    for (const [dateKey, datePlans] of grouped) {
      grouped.set(
        dateKey,
        [...datePlans].sort((a, b) => {
          if (a.id === selectedPlanId) return -1;
          if (b.id === selectedPlanId) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
      );
    }

    return grouped;
  }, [plans, selectedPlanId]);

  const monthDates = useMemo(() => buildMonthDates(visibleMonth), [visibleMonth]);

  // Keep selectedDate inside the visible month when navigating months (no jump to first plan day).
  useEffect(() => {
    const visibleKeys = monthDates.map((date) => isoDateOnly(date));
    if (visibleKeys.includes(selectedDate)) return;
    const todayInMonth = visibleKeys.find((key) => key === todayKey);
    if (todayInMonth) {
      setSelectedDate(todayInMonth);
      return;
    }
    if (monthDates.length > 0) {
      setSelectedDate(isoDateOnly(monthDates[0]));
    }
  }, [monthDates, selectedDate, todayKey]);

  // Scroll today's chip into view when the strip mounts / month includes today.
  useEffect(() => {
    const root = stripScrollRef.current;
    if (!root) return;
    const todayChip = root.querySelector<HTMLElement>(`[data-date-key="${todayKey}"]`);
    if (!todayChip) return;
    todayChip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [visibleMonth, todayKey]);

  const selectedDatePlans = plansByDate.get(selectedDate) ?? [];

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(visibleMonth),
    [visibleMonth],
  );

  const handlePickDate = (dateKey: string) => {
    setUserPickedDate(true);
    setSelectedDate(dateKey);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            setUserPickedDate(true);
            setVisibleMonth((current) => addMonths(current, -1));
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold capitalize text-foreground">{monthLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("share.publish.picker.stripHint", "Choose a date, then pick a plan card")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => {
            setUserPickedDate(true);
            setVisibleMonth((current) => addMonths(current, 1));
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={stripScrollRef}
        className="scrollbar-hide -mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max gap-2">
          {monthDates.map((date) => {
            const dateKey = isoDateOnly(date);
            const count = plansByDate.get(dateKey)?.length ?? 0;
            const active = dateKey === selectedDate;
            const isToday = dateKey === todayKey;

            return (
              <button
                key={dateKey}
                type="button"
                data-date-key={dateKey}
                onClick={() => handlePickDate(dateKey)}
                className={cn(
                  "relative flex min-w-[58px] flex-col items-center rounded-xl border px-3 py-2 text-center transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : count > 0
                      ? "border-border/70 bg-background text-foreground"
                      : "border-border/50 bg-muted/30 text-muted-foreground",
                  !active && isToday ? "ring-1 ring-primary/40" : "",
                )}
              >
                <span className="text-[10px] font-medium uppercase">
                  {new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date)}
                </span>
                <span className="mt-1 text-base font-semibold">{date.getDate()}</span>
                <span
                  className={cn(
                    "mt-1 text-[10px]",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {isToday
                    ? t("share.publish.picker.today", "Today")
                    : count
                      ? t("share.publish.picker.count", "{{count}} plan", { count })
                      : t("share.publish.picker.emptyDay", "No plan")}
                </span>
                {isToday ? (
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 rounded-full",
                      active ? "bg-primary-foreground" : "bg-primary",
                    )}
                    aria-hidden
                  />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {onCreatePlan ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full gap-1.5"
          disabled={createDisabled}
          onClick={() => onCreatePlan(selectedDate)}
        >
          <Plus className="h-4 w-4" />
          {t("share.publish.create.cta", "Create new plan")}
        </Button>
      ) : null}

      <div className="space-y-2">
        {selectedDatePlans.length ? (
          selectedDatePlans.map((plan) => {
            const selected = plan.id === selectedPlanId;
            const forceUploaded = uploadedSet.has(plan.id);
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setUserPickedDate(false);
                  onSelect(plan);
                }}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  cardToneClass(plan, forceUploaded),
                  selected ? "ring-2 ring-primary ring-offset-1" : "",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {plan.title?.trim() || "(Untitled plan)"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(plan.post_date)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-foreground">
                    {statusLabel(plan, t, forceUploaded)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground/80">
                      {t("share.publish.fields.contentType", "Content type")}
                    </p>
                    <p className="mt-0.5">{plan.content_type?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground/80">
                      {t("share.publish.fields.service", "Service")}
                    </p>
                    <p className="mt-0.5">{plan.service?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground/80">
                      {t("share.publish.fields.subService", "Sub service")}
                    </p>
                    <p className="mt-0.5">{plan.sub_service?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground/80">
                      {t("share.publish.fields.contentPillar", "Content pillar")}
                    </p>
                    <p className="mt-0.5">{plan.content_pillar?.name || "-"}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-white/70 px-2 py-1">
                    {plan.production_approved
                      ? plan.pic_production?.full_name || plan.pic?.full_name || "-"
                      : plan.pic?.full_name || "-"}
                  </span>
                  {Number(plan.production_revision_count || 0) > 0 ? (
                    <span className="rounded-full bg-white/70 px-2 py-1">
                      {t("share.publish.picker.revisionCount", "Rev {{count}}", {
                        count: Number(plan.production_revision_count || 0),
                      })}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
            {t(
              "share.publish.picker.noPlansForDate",
              "No plans for this date. Create a new plan to continue.",
            )}
          </div>
        )}
      </div>
    </div>
  );
}
