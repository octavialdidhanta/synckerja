import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { PosTableMapFooter } from "../components/PosTableMapFooter";
import { PosTableMapHeader } from "../components/PosTableMapHeader";

/** Layout-matched skeleton for `/pos/table-map`. */
export function PosTableMapSkeleton() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();

  return (
    <div
      className={
        isPhoneLayout
          ? "fixed inset-0 flex flex-col overflow-hidden bg-white"
          : "fixed inset-0 flex flex-col overflow-hidden bg-slate-100"
      }
      aria-label="Loading table map"
    >
      {isPhoneLayout ? <PosSafeAreaTopSpacer /> : null}
      <PosTableMapHeader phoneLayout={isPhoneLayout} />
      <div className="min-h-0 flex-1 p-3" aria-hidden>
        <div className="h-full min-h-[240px] animate-pulse rounded-lg bg-slate-200/70" />
      </div>
      <PosTableMapFooter
        groups={[]}
        activeGroupId={null}
        onSelectGroup={() => undefined}
        outletLabel=""
        onOpenMenu={() => undefined}
        menuAriaLabel="Menu"
      />
    </div>
  );
}
