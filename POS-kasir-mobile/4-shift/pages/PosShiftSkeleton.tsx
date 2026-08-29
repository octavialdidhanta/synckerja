import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSettingsShell } from "@/pos-mobile/3-settings/components/PosSettingsShell";

/** Layout-matched skeleton for `/pos/shift`. */
export function PosShiftSkeleton() {
  return (
    <PosSettingsShell
      leftHeader="…"
      rightHeader="…"
      left={
        <div className="space-y-3 p-4" aria-hidden>
          <div className="mx-auto h-20 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-12 animate-pulse rounded bg-slate-100" />
          <div className="h-12 animate-pulse rounded bg-slate-100" />
          <div className="h-12 animate-pulse rounded bg-slate-100" />
        </div>
      }
      right={
        <div className="space-y-4 p-4" aria-hidden>
          <div className="h-14 animate-pulse rounded bg-slate-100" />
          <div className="h-14 animate-pulse rounded bg-slate-100" />
          <div className="h-24 animate-pulse rounded bg-slate-100" />
        </div>
      }
      footer={
        <PosAppFooterBar outletLabel="" onOpenMenu={() => undefined} menuAriaLabel="Menu" />
      }
    />
  );
}
