import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { MobileApprovalsCarouselSkeleton } from "@/mobile/2-approvals/pages/MobileApprovalsPageSkeleton";
import { ApprovalsTotalRequestsCard } from "@/mobile/2-approvals/section/approvals/ApprovalsTotalRequestsCard";
import { ApprovalsPendingReviewCard } from "@/mobile/2-approvals/section/approvals/ApprovalsPendingReviewCard";
import { ApprovalsApprovedCard } from "@/mobile/2-approvals/section/approvals/ApprovalsApprovedCard";
import { ApprovalsRecurringCard } from "@/mobile/2-approvals/section/approvals/ApprovalsRecurringCard";

const LOGICAL_SLIDE_COUNT = 4;
const TRANSITION_MS = 400;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const TRACK_LENGTH = 6;
const FIRST_REAL = 1;
const LAST_REAL = 4;

export interface ApprovalsDashboardCarouselProps {
  isLoading: boolean;
  totalRequests: number;
  pendingReview: number;
  approved: number;
  recurring: number;
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  recurringAmount: number;
}

export function ApprovalsDashboardCarousel({
  isLoading,
  totalRequests,
  pendingReview,
  approved,
  recurring,
  totalAmount,
  pendingAmount,
  approvedAmount,
  recurringAmount,
}: ApprovalsDashboardCarouselProps) {
  const [index, setIndex] = useState(FIRST_REAL);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((next: number) => {
    setIndex(next);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 24;
    if (diff > threshold) {
      if (index === LAST_REAL) goTo(5);
      else goTo(index + 1);
    } else if (diff < -threshold) {
      if (index === FIRST_REAL) goTo(0);
      else goTo(index - 1);
    }
  }, [index, goTo]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onTransitionEnd = () => {
      if (index === 0) {
        setTransitionEnabled(false);
        setIndex(LAST_REAL);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransitionEnabled(true));
        });
      } else if (index === 5) {
        setTransitionEnabled(false);
        setIndex(FIRST_REAL);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransitionEnabled(true));
        });
      }
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [index]);

  const logicalIndex = index === 0 ? 3 : index === 5 ? 0 : index - 1;

  if (isLoading) {
    return <MobileApprovalsCarouselSkeleton />;
  }

  const slideWidthPercent = 100 / TRACK_LENGTH;

  const slide = (key: string, node: ReactNode) => (
    <div key={key} className="flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
      {node}
    </div>
  );

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div
        ref={trackRef}
        className="flex touch-pan-y select-none"
        style={{
          width: `${TRACK_LENGTH * 100}%`,
          transform: `translate3d(-${index * slideWidthPercent}%, 0, 0)`,
          transition: transitionEnabled ? `transform ${TRANSITION_MS}ms ${EASING}` : "none",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slide(
          "clone-recurring",
          <ApprovalsRecurringCard count={recurring} recurringAmount={recurringAmount} />,
        )}
        {slide(
          "total",
          <ApprovalsTotalRequestsCard count={totalRequests} totalAmount={totalAmount} />,
        )}
        {slide(
          "pending",
          <ApprovalsPendingReviewCard count={pendingReview} pendingAmount={pendingAmount} />,
        )}
        {slide(
          "approved",
          <ApprovalsApprovedCard count={approved} approvedAmount={approvedAmount} />,
        )}
        {slide(
          "recurring",
          <ApprovalsRecurringCard count={recurring} recurringAmount={recurringAmount} />,
        )}
        {slide(
          "clone-total",
          <ApprovalsTotalRequestsCard count={totalRequests} totalAmount={totalAmount} />,
        )}
      </div>

      <div className="flex justify-center gap-1.5 pb-1 pt-1">
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Approvals slide ${i + 1}`}
            onClick={() => goTo(i + 1)}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              i === logicalIndex ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
