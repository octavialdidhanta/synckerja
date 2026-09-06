import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { PosSettingsShell } from "@/pos-mobile/3-settings/components/PosSettingsShell";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";

/** Layout-matched skeleton for `/pos/shift`. */
export function PosShiftSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-white">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="space-y-3 p-4" aria-hidden>
            <div className="mx-auto h-20 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-12 animate-pulse rounded bg-slate-100" />
            <div className="h-12 animate-pulse rounded bg-slate-100" />
            <div className="h-12 animate-pulse rounded bg-slate-100" />
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
    <PosSettingsShell
      leftHeader="…"
      rightHeader="…"
      rightPaneClassName="bg-slate-100"
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
        <div className="min-h-full space-y-4 bg-slate-100 p-4" aria-hidden>
          <div className="h-14 animate-pulse rounded-lg bg-white shadow-sm" />
          <div className="h-14 animate-pulse rounded-lg bg-white shadow-sm" />
          <div className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
        </div>
      }
      footer={
        <PosAppFooterBar outletLabel="" onOpenMenu={() => undefined} menuAriaLabel="Menu" />
      }
    />
  );
}
