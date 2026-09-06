import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { cn } from "@/shared/lib/utils";

/** Layout-matched skeleton for `/pos/inventory`. */
export function PosInventoryPageSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
          <div className="space-y-2 border-b border-slate-200 bg-white px-2 py-2.5 sm:px-2.5">
            <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
            <div className="flex gap-2">
              <div className="h-9 min-w-0 flex-1 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-9 min-w-0 flex-1 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
          <div className={cn(POS_PANEL.body, "pt-2")}>
            <div className={cn(POS_PANEL.card, "divide-y divide-slate-200")}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <div className="h-9 w-9 animate-pulse rounded-md bg-slate-100" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
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
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-3 sm:px-2.5">
        <div className="flex gap-2">
          <div className="h-10 w-44 animate-pulse rounded-md bg-white shadow-sm" />
          <div className="h-10 w-40 animate-pulse rounded-md bg-white shadow-sm" />
          <div className="h-10 min-w-0 flex-1 animate-pulse rounded-md bg-white shadow-sm" />
        </div>
        <div className={cn(POS_PANEL.card, "min-h-0 flex-1 p-3")}>
          <div className="mb-3 h-5 w-28 animate-pulse rounded bg-slate-100" />
          <div className="space-y-0 divide-y divide-slate-200">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 animate-pulse rounded-md bg-slate-100" />
                <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <PosAppFooterBar outletLabel="…" onOpenMenu={() => undefined} />
    </div>
  );
}
