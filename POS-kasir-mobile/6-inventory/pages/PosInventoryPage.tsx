import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useCatalogIngredients } from "@/8-2-3-ingredient/library/hooks/useCatalogIngredients";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { usePosKeyboardShellStyle } from "@/pos-mobile/shared/hooks/usePosKeyboardShellStyle";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { PosCashierMenuDrawer } from "@/pos-mobile/2-cashier/components/PosCashierMenuDrawer";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import { PosInventoryPhoneList } from "../components/PosInventoryPhoneList";
import { PosInventoryTable } from "../components/PosInventoryTable";
import { PosInventoryToolbar } from "../components/PosInventoryToolbar";
import {
  filterPosInventoryRows,
  POS_INVENTORY_FILTER_ALL,
  type PosInventoryKindFilter,
  type PosInventoryStatusFilter,
} from "../lib/filterPosInventoryRows";
import { POS_INVENTORY_I18N } from "../lib/posInventoryCopy";
import { PosInventoryPageSkeleton } from "./PosInventoryPageSkeleton";

/**
 * Synckerja POS Inventory — read-only ingredient stock for the selected outlet.
 * Authenticated route: `/pos/inventory`.
 * SSOT: `useCatalogIngredients` + `ingredientStockStatus` (same as BO Ingredient Library).
 */
export default function PosInventoryPage() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  usePosTabletShell({ phoneOverlay: isPhoneLayout });
  useMarkPosAuthSurface();
  const keyboardShellStyle = usePosKeyboardShellStyle();
  const { t } = useAppTranslation();
  const permissions = usePosAppPermissions();

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const outletName = outletMeta?.name || outletId || "";

  const { rows, isLoading } = useCatalogIngredients();
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<PosInventoryKindFilter>(POS_INVENTORY_FILTER_ALL);
  const [inventoryStatus, setInventoryStatus] =
    useState<PosInventoryStatusFilter>(POS_INVENTORY_FILTER_ALL);
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!outletId) return [];
    return filterPosInventoryRows({
      rows,
      outletId,
      kind,
      inventoryStatus,
      search,
    });
  }, [inventoryStatus, kind, outletId, rows, search]);

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (permissions.isLoading) {
    return <PosInventoryPageSkeleton />;
  }

  if (!permissions.canViewInventory()) {
    return (
      <Navigate
        to={resolvePosPostOutletPath({
          canCharge: permissions.canCharge(),
          canKitchenDisplay: permissions.canKitchenDisplay(),
        })}
        replace
      />
    );
  }

  if (isLoading && rows.length === 0) {
    return <PosInventoryPageSkeleton />;
  }

  const toolbar = (
    <PosInventoryToolbar
      kind={kind}
      onKindChange={setKind}
      inventoryStatus={inventoryStatus}
      onInventoryStatusChange={setInventoryStatus}
      search={search}
      onSearchChange={setSearch}
      isPhoneLayout={isPhoneLayout}
    />
  );

  return (
    <>
      <div
        className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100"
        style={keyboardShellStyle}
      >
        {isPhoneLayout ? (
          <>
            <PosSafeAreaTopSpacer />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
              {toolbar}
              <div className={cn(POS_PANEL.body, "flex min-h-0 flex-col pt-2")}>
                <div className={cn(POS_PANEL.card, "flex min-h-0 flex-1 flex-col")}>
                  <PosInventoryPhoneList
                    outletId={outletId}
                    rows={filteredRows}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-3 pb-3 sm:px-2.5">
            {toolbar}
            <section
              className={cn(POS_PANEL.card, "flex min-h-0 flex-1 flex-col")}
            >
              <div className="flex-shrink-0 border-b border-slate-200 px-3 py-3">
                <h1 className="text-base font-semibold text-slate-900">
                  {t(POS_INVENTORY_I18N.title, "Inventory")}
                </h1>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-1 sm:px-2">
                <PosInventoryTable
                  outletId={outletId}
                  rows={filteredRows}
                  isLoading={isLoading}
                />
              </div>
            </section>
          </div>
        )}

        <PosAppFooterBar
          outletLabel={
            isPhoneLayout
              ? t(POS_INVENTORY_I18N.title, "Inventory")
              : outletName
          }
          onOpenMenu={() => setMenuOpen(true)}
          menuAriaLabel={t(POS_INVENTORY_I18N.menu, "Menu")}
        />
      </div>

      <PosCashierMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        outletName={outletName}
        activeId="inventory"
      />
    </>
  );
}
