import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";

/** Layout-matched skeleton for `/pos/activity` (split master–detail). */
export function PosActivityPageSkeleton() {
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100">
      <div className="flex min-h-0 flex-1 flex-col p-4 pb-3">
        <div className="mb-3 flex flex-shrink-0 items-center justify-center">
          <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex w-[34%] min-w-[240px] flex-col border-r border-slate-200">
            <div className="border-b border-slate-100 p-3">
              <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <div className="h-9 w-9 animate-pulse rounded-md bg-slate-100" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <div className="mb-4 flex gap-2">
              <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-slate-100" />
              <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="mb-3 h-3 w-16 animate-pulse rounded bg-slate-100" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded bg-slate-50" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <PosAppFooterBar outletLabel="…" onOpenMenu={() => undefined} />
    </div>
  );
}
