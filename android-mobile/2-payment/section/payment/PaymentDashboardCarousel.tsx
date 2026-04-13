import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { MobilePaymentCarouselSkeleton } from "@/mobile/2-payment/pages/MobilePaymentProcessPageSkeleton";
import { PaymentReadyToPayCard } from "@/mobile/2-payment/section/payment/PaymentReadyToPayCard";
import { PaymentPendingPaymentCard } from "@/mobile/2-payment/section/payment/PaymentPendingPaymentCard";
import { PaymentPaidCarouselCard } from "@/mobile/2-payment/section/payment/PaymentPaidCarouselCard";
import { PaymentProcessingCarouselCard } from "@/mobile/2-payment/section/payment/PaymentProcessingCarouselCard";

const LOGICAL_SLIDE_COUNT = 4;
const TRANSITION_MS = 400;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const TRACK_LENGTH = 6;
const FIRST_REAL = 1;
const LAST_REAL = 4;

export interface PaymentDashboardCarouselProps {
  isLoading: boolean;
  readyToPay: number;
  pendingPayment: number;
  paid: number;
  processing: number;
  readyToPayAmount: number;
  pendingPaymentAmount: number;
  paidAmount: number;
  processingAmount: number;
}

export function PaymentDashboardCarousel({
  isLoading,
  readyToPay,
  pendingPayment,
  paid,
  processing,
  readyToPayAmount,
  pendingPaymentAmount,
  paidAmount,
  processingAmount,
}: PaymentDashboardCarouselProps) {
  const [index, setIndex] = useState(FIRST_REAL);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((next: number) => setIndex(next), []);

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
        requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
      } else if (index === 5) {
        setTransitionEnabled(false);
        setIndex(FIRST_REAL);
        requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
      }
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [index]);

  const logicalIndex = index === 0 ? 3 : index === 5 ? 0 : index - 1;

  if (isLoading) {
    return <MobilePaymentCarouselSkeleton />;
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
          "clone-processing",
          <PaymentProcessingCarouselCard count={processing} amount={processingAmount} />,
        )}
        {slide(
          "ready",
          <PaymentReadyToPayCard count={readyToPay} amount={readyToPayAmount} />,
        )}
        {slide(
          "pending",
          <PaymentPendingPaymentCard count={pendingPayment} amount={pendingPaymentAmount} />,
        )}
        {slide("paid", <PaymentPaidCarouselCard count={paid} amount={paidAmount} />)}
        {slide(
          "processing",
          <PaymentProcessingCarouselCard count={processing} amount={processingAmount} />,
        )}
        {slide(
          "clone-ready",
          <PaymentReadyToPayCard count={readyToPay} amount={readyToPayAmount} />,
        )}
      </div>

      <div className="flex justify-center gap-1.5 pb-1 pt-1">
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Payment slide ${i + 1}`}
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
