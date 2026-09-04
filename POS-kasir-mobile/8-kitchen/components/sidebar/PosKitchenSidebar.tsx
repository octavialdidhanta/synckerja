import {
  Bike,
  LayoutGrid,
  Pause,
  RotateCcw,
  Settings,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { KitchenBoardMode } from "../../lib/kitchenBoardMode";
import type { KitchenSalesTypeBucket } from "../../lib/kitchenSalesTypeBucket";
import { POS_KITCHEN_I18N } from "../../lib/posKitchenCopy";
import { POS_KITCHEN_SETTINGS_I18N } from "../../settings/lib/posKitchenSettingsCopy";
import { PosKitchenSidebarNavItem } from "./PosKitchenSidebarNavItem";

type Props = {
  mode: KitchenBoardMode;
  openCount: number;
  completedCount: number;
  bucketCounts: Record<KitchenSalesTypeBucket, number>;
  recallCount: number;
  heldCount: number;
  /** Which sales-type filters appear (KDS prefs; default all true). */
  orderTypeVisibility?: Record<KitchenSalesTypeBucket, boolean>;
  /** Show Back to POS when staff also has cashier access. */
  showBackToPos?: boolean;
  /** `rail` = left column (tablet); `bottom` = horizontal phone bar. */
  layout?: "rail" | "bottom";
  onSelectOpen: () => void;
  onSelectBucket: (bucket: KitchenSalesTypeBucket) => void;
  onSelectRecall: () => void;
  onSelectHeld: () => void;
  onSelectCompleted: () => void;
  onOpenSettings: () => void;
  onBackToPos?: () => void;
};

const BUCKET_META: {
  id: KitchenSalesTypeBucket;
  icon: typeof UtensilsCrossed;
  labelKey: string;
  fallback: string;
}[] = [
  {
    id: "dine_in",
    icon: UtensilsCrossed,
    labelKey: POS_KITCHEN_I18N.dineIn,
    fallback: "Dine In",
  },
  {
    id: "takeaway",
    icon: ShoppingBag,
    labelKey: POS_KITCHEN_I18N.takeaway,
    fallback: "Takeaway",
  },
  {
    id: "delivery",
    icon: Bike,
    labelKey: POS_KITCHEN_I18N.delivery,
    fallback: "Delivery",
  },
  {
    id: "pickup",
    icon: Store,
    labelKey: POS_KITCHEN_I18N.pickup,
    fallback: "Pickup",
  },
];

function isBucketActive(
  mode: KitchenBoardMode,
  bucket: KitchenSalesTypeBucket,
): boolean {
  return mode.kind === "active" && mode.salesType === bucket;
}

/**
 * KDS navigation — left rail (tablet) or horizontal bottom bar (phone).
 */
export function PosKitchenSidebar({
  mode,
  openCount,
  completedCount,
  bucketCounts,
  recallCount,
  heldCount,
  orderTypeVisibility,
  showBackToPos,
  layout = "rail",
  onSelectOpen,
  onSelectBucket,
  onSelectRecall,
  onSelectHeld,
  onSelectCompleted,
  onOpenSettings,
  onBackToPos,
}: Props) {
  const { t } = useAppTranslation();
  const horizontal = layout === "bottom";
  const visibleBuckets = BUCKET_META.filter(
    (item) => orderTypeVisibility?.[item.id] !== false,
  );

  const filters = (
    <>
      <PosKitchenSidebarNavItem
        icon={UtensilsCrossed}
        label={t(POS_KITCHEN_I18N.open, "Open")}
        count={horizontal ? undefined : openCount}
        badge={horizontal ? openCount : undefined}
        countTone="green"
        active={mode.kind === "active" && mode.salesType === "all"}
        onClick={onSelectOpen}
        horizontal={horizontal}
      />

      {horizontal ? (
        <div className="mx-0.5 w-px self-stretch bg-slate-700" aria-hidden />
      ) : (
        <div className="mx-2 my-1 h-px bg-slate-700" aria-hidden />
      )}

      {visibleBuckets.map((item) => (
        <PosKitchenSidebarNavItem
          key={item.id}
          icon={item.icon}
          label={t(item.labelKey, item.fallback)}
          badge={bucketCounts[item.id]}
          active={isBucketActive(mode, item.id)}
          onClick={() => onSelectBucket(item.id)}
          compact={!horizontal}
          horizontal={horizontal}
        />
      ))}

      {horizontal ? (
        <div className="mx-0.5 w-px self-stretch bg-slate-700" aria-hidden />
      ) : (
        <div className="mx-2 my-1 h-px bg-slate-700" aria-hidden />
      )}

      <PosKitchenSidebarNavItem
        icon={RotateCcw}
        label={t(POS_KITCHEN_I18N.recall, "Recall")}
        badge={recallCount}
        active={mode.kind === "recall"}
        onClick={onSelectRecall}
        compact={!horizontal}
        horizontal={horizontal}
      />
      <PosKitchenSidebarNavItem
        icon={Pause}
        label={t(POS_KITCHEN_I18N.onHold, "On-Hold")}
        badge={heldCount}
        active={mode.kind === "held"}
        onClick={onSelectHeld}
        compact={!horizontal}
        horizontal={horizontal}
      />

      {horizontal ? (
        <div className="mx-0.5 w-px self-stretch bg-slate-700" aria-hidden />
      ) : (
        <div className="mx-2 my-1 h-px bg-slate-700" aria-hidden />
      )}

      <PosKitchenSidebarNavItem
        icon={Store}
        label={t(POS_KITCHEN_I18N.completed, "Completed")}
        count={horizontal ? undefined : completedCount}
        badge={horizontal ? completedCount : undefined}
        countTone="slate"
        active={mode.kind === "completed_today"}
        onClick={onSelectCompleted}
        horizontal={horizontal}
      />
    </>
  );

  const actions = (
    <>
      {showBackToPos ? (
        <PosKitchenSidebarNavItem
          icon={LayoutGrid}
          label={t(POS_KITCHEN_SETTINGS_I18N.navPos, "POS")}
          onClick={() => onBackToPos?.()}
          compact={!horizontal}
          horizontal={horizontal}
        />
      ) : null}
      <PosKitchenSidebarNavItem
        icon={Settings}
        label={t(POS_KITCHEN_I18N.settings, "Settings")}
        onClick={onOpenSettings}
        compact={!horizontal}
        horizontal={horizontal}
      />
    </>
  );

  if (horizontal) {
    return (
      <nav
        className="flex flex-shrink-0 flex-col bg-slate-900 text-white safe-area-bottom"
        aria-label={t(POS_KITCHEN_I18N.title, "Kitchen Display System")}
      >
        <div className="flex min-h-14 items-stretch border-t border-slate-700">
          <div
            className={cn(
              "scrollbar-hide flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {filters}
          </div>
          <div className="flex flex-shrink-0 items-stretch border-l border-slate-700 bg-slate-950">
            {actions}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <aside
      className="flex w-[92px] flex-shrink-0 flex-col overflow-hidden border-r border-slate-700 bg-slate-900"
      aria-label={t(POS_KITCHEN_I18N.title, "Kitchen Display System")}
    >
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters}
      </div>

      <div className="flex flex-shrink-0 flex-col border-t border-slate-700">
        {actions}
      </div>
    </aside>
  );
}
