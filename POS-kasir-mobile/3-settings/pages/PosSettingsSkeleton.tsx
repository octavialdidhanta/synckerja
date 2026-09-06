import { cn } from "@/shared/lib/utils";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSettingsShell } from "../components/PosSettingsShell";

function SettingsNavSkeleton() {
  return (
    <div className={cn(POS_PANEL.body, "space-y-3")} aria-hidden>
      <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-slate-200" />
      <div className="mx-auto h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mx-auto h-3 w-48 animate-pulse rounded bg-slate-200/80" />
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200/80" />
      <div className={cn(POS_PANEL.card, "divide-y divide-slate-200")}>
        <div className="h-11 animate-pulse bg-slate-100" />
        <div className="h-11 animate-pulse bg-slate-100" />
        <div className="h-11 animate-pulse bg-slate-100" />
      </div>
      <div className="h-3 w-28 animate-pulse rounded bg-slate-200/80" />
      <div className={cn(POS_PANEL.card, "divide-y divide-slate-200")}>
        <div className="h-11 animate-pulse bg-slate-100" />
        <div className="h-11 animate-pulse bg-slate-100" />
      </div>
    </div>
  );
}

function SettingsDetailSkeleton() {
  return (
    <div className={cn(POS_PANEL.body, "space-y-3")} aria-hidden>
      <div className="h-3 w-32 animate-pulse rounded bg-slate-200/80" />
      <div className={cn(POS_PANEL.card, "h-14 animate-pulse bg-slate-100")} />
      <div className="h-3 w-28 animate-pulse rounded bg-slate-200/80" />
      <div className={cn(POS_PANEL.card, "divide-y divide-slate-200")}>
        <div className="h-12 animate-pulse bg-slate-100" />
        <div className="h-12 animate-pulse bg-slate-100" />
        <div className="h-12 animate-pulse bg-slate-100" />
      </div>
    </div>
  );
}

/** Layout-matched skeleton for `/pos/settings`. */
export function PosSettingsSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
          <SettingsNavSkeleton />
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
      left={<SettingsNavSkeleton />}
      right={<SettingsDetailSkeleton />}
      footer={
        <PosAppFooterBar outletLabel="" onOpenMenu={() => undefined} menuAriaLabel="Menu" />
      }
    />
  );
}
