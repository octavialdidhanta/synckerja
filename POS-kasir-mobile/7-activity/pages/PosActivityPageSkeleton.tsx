import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { cn } from "@/shared/lib/utils";

/** Layout-matched skeleton for `/pos/activity` (split tablet / phone swipe List|Detail). */
export function PosActivityPageSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
          <div className="border-b border-slate-200 bg-white px-2 py-2.5 sm:px-2.5">
            <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
          </div>
          <div className={cn(POS_PANEL.body, "pt-2")}>
            <div className={cn(POS_PANEL.card, "divide-y divide-slate-200")}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-md bg-slate-100" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <PosAppFooterBar
          outletLabel="…"
          onOpenMenu={() => undefined}
          menuAriaLabel="Menu"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100">
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-3 pb-3 sm:px-2.5">
        <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
          <div className="flex w-[34%] min-w-[240px] flex-col border-r border-slate-200">
            <div className="border-b border-slate-200 p-3">
              <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="space-y-0 divide-y divide-slate-200">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2.5 px-3 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-md bg-slate-100" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3 bg-slate-100 p-3">
            <div className="h-28 animate-pulse rounded-lg bg-white shadow-sm" />
            <div className="h-40 animate-pulse rounded-lg bg-white shadow-sm" />
          </div>
        </div>
      </div>
      <PosAppFooterBar outletLabel="…" onOpenMenu={() => undefined} />
    </div>
  );
}
