import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
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
  onDeletePlan?: (plan: PlanLike) => void;
  deletingPlanId?: string | null;
  onAddContent?: (date: Date) => void;
};

const ACTION_STRIP_WIDTH = 72;
const SWIPE_OPEN_THRESHOLD = 40;
const DIRECTION_LOCK_PX = 10;
const TAP_MOVE_MAX = 14;
const SNAP_TRANSITION = "transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)";

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

function MobilePlanSwipeRow({
  planId,
  isRevealed,
  onReveal,
  onClose,
  onSelect,
  onDelete,
  deleting,
  deleteLabel,
  children,
}: {
  planId: string;
  isRevealed: boolean;
  onReveal: () => void;
  onClose: () => void;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
  deleteLabel: string;
  children: ReactNode;
}) {
  const slidingRowRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    lockHorizontal: boolean | null;
  } | null>(null);
  const translateXRef = useRef(0);
  const lockHorizontalRef = useRef(false);
  const ignoreClickRef = useRef(false);
  const isDraggingRef = useRef(false);

  const applyTransform = (x: number, animate: boolean) => {
    translateXRef.current = x;
    const el = slidingRowRef.current;
    if (!el) return;
    el.style.transition = animate ? SNAP_TRANSITION : "none";
    el.style.transform = `translateX(${x}px)`;
  };

  useEffect(() => {
    const el = slidingRowRef.current;
    if (!el) return;
    const onMove = (e: globalThis.TouchEvent) => {
      if (lockHorizontalRef.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  useEffect(() => {
    if (isDraggingRef.current) return;
    applyTransform(isRevealed ? -ACTION_STRIP_WIDTH : 0, true);
  }, [isRevealed]);

  const handleTouchStart = (e: ReactTouchEvent) => {
    const target = e.target;
    if (target instanceof Element && target.closest("[data-plan-swipe-delete]")) {
      touchStartRef.current = null;
      return;
    }
    isDraggingRef.current = true;
    ignoreClickRef.current = false;
    lockHorizontalRef.current = false;
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTranslateX: translateXRef.current,
      lockHorizontal: null,
    };
    applyTransform(translateXRef.current, false);
  };

  const handleTouchMove = (e: ReactTouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const deltaX = e.touches[0].clientX - start.startX;
    const deltaY = e.touches[0].clientY - start.startY;

    if (start.lockHorizontal === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
        start.lockHorizontal = absX >= absY;
        lockHorizontalRef.current = start.lockHorizontal;
      }
    }

    if (start.lockHorizontal !== true) return;

    const next = Math.min(0, Math.max(-ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
    if (Math.abs(deltaX) > TAP_MOVE_MAX) ignoreClickRef.current = true;
    applyTransform(next, false);
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    isDraggingRef.current = false;
    lockHorizontalRef.current = false;
    touchStartRef.current = null;
    if (!start) return;

    if (start.lockHorizontal !== true) {
      applyTransform(isRevealed ? -ACTION_STRIP_WIDTH : 0, true);
      return;
    }

    const current = translateXRef.current;
    const shouldOpen = current <= -SWIPE_OPEN_THRESHOLD;
    applyTransform(shouldOpen ? -ACTION_STRIP_WIDTH : 0, true);
    if (shouldOpen) onReveal();
    else onClose();
  };

  const handleClick = () => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (isRevealed) {
      onClose();
      return;
    }
    onSelect();
  };

  return (
    <div
      data-plan-swipe-id={planId}
      className="relative overflow-hidden rounded-lg border border-border bg-card"
    >
      <button
        type="button"
        data-plan-swipe-delete
        disabled={deleting}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute inset-y-0 right-0 flex w-[72px] flex-col items-center justify-center gap-0.5 bg-destructive text-destructive-foreground disabled:opacity-60"
        aria-label={deleteLabel}
      >
        <Trash2 className="h-4 w-4" />
        <span className="text-[10px] font-medium leading-none">{deleteLabel}</span>
      </button>
      <div
        ref={slidingRowRef}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative z-[1] flex w-full cursor-pointer items-stretch gap-0 bg-card text-left transition-colors hover:bg-muted/60 active:bg-muted"
        style={{ transform: "translateX(0px)" }}
      >
        {children}
      </div>
    </div>
  );
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
  onDeletePlan,
  deletingPlanId,
  onAddContent,
}: Props) {
  const { t } = useAppTranslation();
  const [revealedPlanId, setRevealedPlanId] = useState<string | null>(null);
  const dateLabel = selectedDate
    ? format(selectedDate, "dd MMMM yyyy", { locale: id })
    : "";

  useEffect(() => {
    if (!open) setRevealedPlanId(null);
  }, [open]);

  useEffect(() => {
    if (!revealedPlanId) return;
    if (!plans.some((plan) => plan.id === revealedPlanId)) {
      setRevealedPlanId(null);
    }
  }, [plans, revealedPlanId]);

  useEffect(() => {
    if (!revealedPlanId) return;
    const closeIfOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(`[data-plan-swipe-id="${revealedPlanId}"]`)) return;
      if (target.closest("[role='alertdialog']")) return;
      setRevealedPlanId(null);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    return () => document.removeEventListener("pointerdown", closeIfOutside);
  }, [revealedPlanId]);

  return (
    <Drawer shouldScaleBackground={false} open={open} onOpenChange={onOpenChange}>
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

        <div
          className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto px-4 pb-2"
          onScroll={() => {
            if (revealedPlanId) setRevealedPlanId(null);
          }}
        >
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
            plans.map((plan, index) => {
              const tone = getCalendarPlanCardTone(plan);
              const meta = [
                plan.service?.name,
                plan.sub_service?.name,
                plan.content_pillar?.name,
              ]
                .filter(Boolean)
                .join(" - ");
              const planKey = plan.id ?? `plan-${index}`;
              const cardBody = (
                <>
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
                </>
              );

              if (!onDeletePlan || !plan.id) {
                return (
                  <button
                    key={planKey}
                    type="button"
                    onClick={() => onSelectPlan(plan)}
                    className={cn(
                      "flex w-full items-stretch gap-0 overflow-hidden rounded-lg border border-border bg-card text-left transition-colors",
                      "hover:bg-muted/60 active:bg-muted",
                    )}
                  >
                    {cardBody}
                  </button>
                );
              }

              return (
                <MobilePlanSwipeRow
                  key={planKey}
                  planId={plan.id}
                  isRevealed={revealedPlanId === plan.id}
                  onReveal={() => setRevealedPlanId(plan.id ?? null)}
                  onClose={() => {
                    setRevealedPlanId((current) => (current === plan.id ? null : current));
                  }}
                  onSelect={() => onSelectPlan(plan)}
                  onDelete={() => {
                    setRevealedPlanId(null);
                    onDeletePlan(plan);
                  }}
                  deleting={deletingPlanId === plan.id}
                  deleteLabel={t("contentCalendar.mobile.deletePlan", "Delete")}
                >
                  {cardBody}
                </MobilePlanSwipeRow>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
