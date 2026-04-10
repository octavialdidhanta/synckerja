import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import type { Debt } from "@/4-2-debt/types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDebtPayments } from "@/4-2-debt/hooks/useDebtPayments";
import { SwipeableDebtPaymentRow } from "@/4-2-debt/components/SwipeableDebtPaymentRow";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface MobileDebtPaymentHistoryModalProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentDeleted?: () => void;
}

export function MobileDebtPaymentHistoryModal({
  debt,
  isOpen,
  onClose,
  onPaymentDeleted,
}: MobileDebtPaymentHistoryModalProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const debtId = debt?.id ?? null;
  const { payments, isLoading, refetch } = useDebtPayments(debtId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);

  const PULL_THRESHOLD = 52;
  const MAX_PULL = 72;
  const INDICATOR_HEIGHT = 56;
  const PULL_RESISTANCE = 0.55;

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el && el.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing],
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      void handlePullRefresh();
    }
  }, [handlePullRefresh, PULL_THRESHOLD]);

  if (!debt) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          isMobile
            ? "modal-above-safe-area fixed left-0 right-0 top-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0"
            : "flex aspect-square max-h-[92vw] min-w-0 w-[min(92vw,420px)] max-w-none flex-col overflow-hidden p-0 sm:max-h-[420px]",
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader
          className={cn(
            "flex-shrink-0 border-b bg-gradient-to-r from-brand-blue/10 to-brand-blue/5 text-left dark:from-brand-blue/20 dark:to-brand-blue/10",
            isMobile
              ? "flex min-h-[3.25rem] flex-row items-center justify-between gap-3 space-y-0 px-4 py-2 safe-area-top"
              : "px-4 pb-3 pt-4",
          )}
        >
          {isMobile ? (
            <>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-left text-base font-semibold leading-tight">
                  {t("debt.paymentHistory.title", "Payment History")} — {debt.debt_name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t("debt.paymentHistory.description", "Payment history for this debt.")}
                </DialogDescription>
              </div>
              <DialogClose
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
                <span className="sr-only">{t("common.close", "Close")}</span>
              </DialogClose>
            </>
          ) : (
            <>
              <DialogTitle className="text-lg font-semibold">
                {t("debt.paymentHistory.title", "Payment History")} — {debt.debt_name}
              </DialogTitle>
              <DialogDescription>{t("debt.paymentHistory.description", "Payment history for this debt.")}</DialogDescription>
            </>
          )}
        </DialogHeader>

        <div
          ref={listScrollRef}
          className={cn(
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2 seamless-scroll",
            SCROLL_HIDE,
          )}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
            style={{
              height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
              minHeight: 0,
              transition: isPulling
                ? "none"
                : "height 0.35s cubic-bezier(0.42, 0, 0.58, 1), min-height 0.35s cubic-bezier(0.42, 0, 0.58, 1)",
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
            ) : pullDistance >= PULL_THRESHOLD ? (
              <span className="whitespace-nowrap text-xs font-medium text-primary">
                {t("common.pullToRefresh.release", "Lepas untuk refresh")}
              </span>
            ) : (
              <RefreshCw
                className="h-5 w-5 shrink-0 opacity-80"
                style={{
                  transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                  transition: isPulling ? "none" : "transform 0.2s ease-in-out",
                }}
                aria-hidden
              />
            )}
          </div>

          {isLoading && !isRefreshing ? (
            <div className="flex justify-center py-6">
              <div className="animate-pulse text-sm text-gray-500">{t("debt.paymentHistory.loading", "Loading...")}</div>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              {t("debt.paymentHistory.noPayments", "No payment history yet.")}
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <SwipeableDebtPaymentRow
                  key={payment.id}
                  payment={payment}
                  debtDisplayName={debt.debt_name}
                  variant="mobile"
                  t={t}
                  refetchPayments={async () => {
                    await refetch();
                  }}
                  onPaymentDeleted={onPaymentDeleted}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t bg-muted/30 px-4 pb-3 pt-3">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("debt.form.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
