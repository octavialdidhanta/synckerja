import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";

/** Layout-matched skeleton for `/pos/kitchen` (rail tablet / bottom nav phone). */
export function PosKitchenPageSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-white">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden bg-slate-100 p-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-72 min-w-0 flex-1 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
        <div
          className="flex flex-shrink-0 flex-col bg-slate-900 safe-area-bottom"
          aria-hidden
        >
          <div className="flex min-h-14 items-stretch gap-1 border-t border-slate-700 px-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="m-1 h-10 min-w-[3.25rem] flex-1 animate-pulse rounded-md bg-slate-700/80"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-row overflow-hidden bg-slate-100">
      <aside
        className="flex w-[92px] flex-shrink-0 flex-col border-r border-slate-700 bg-slate-900"
        aria-hidden
      >
        <div className="flex flex-1 flex-col gap-2 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="mx-auto h-12 w-full animate-pulse rounded-md bg-slate-700/80"
            />
          ))}
        </div>
        <div className="border-t border-slate-700 p-2">
          <div className="h-10 w-full animate-pulse rounded-md bg-slate-700/80" />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-72 w-[280px] flex-shrink-0 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
