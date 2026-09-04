import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSettingsShell } from "../components/PosSettingsShell";

/** Layout-matched skeleton for `/pos/settings`. */
export function PosSettingsSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-white">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="space-y-3 p-4" aria-hidden>
            <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-slate-200" />
            <div className="mx-auto h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mx-auto h-3 w-48 animate-pulse rounded bg-slate-100" />
            <div className="mt-6 h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded bg-slate-100" />
            <div className="h-8 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded bg-slate-100" />
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
      left={
        <div className="space-y-3 p-4" aria-hidden>
          <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="mx-auto h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mx-auto h-3 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
          <div className="h-8 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
        </div>
      }
      right={
        <div className="space-y-4 p-4" aria-hidden>
          <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
          <div className="h-16 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
          <div className="h-12 animate-pulse rounded bg-slate-100" />
          <div className="h-12 animate-pulse rounded bg-slate-100" />
        </div>
      }
      footer={
        <PosAppFooterBar outletLabel="" onOpenMenu={() => undefined} menuAriaLabel="Menu" />
      }
    />
  );
}
