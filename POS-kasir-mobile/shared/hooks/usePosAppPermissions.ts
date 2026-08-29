import { useMemo } from "react";
import { usePosStaffPermissions } from "@/8-2-8-employees-staff/hooks/usePosStaffPermissions";
import {
  POS_SIDEBAR_ITEMS,
  type PosSidebarItem,
  type PosSidebarItemId,
} from "@/pos-mobile/2-cashier/components/sidebar/posSidebarItems";

/** Map POS mobile sidebar entries → App Permission keys (null = always show). */
export const POS_SIDEBAR_PERMISSION_KEY: Record<PosSidebarItemId, string | null> = {
  tableMap: "app.table_map",
  pointOfSale: "app.pos.charge",
  onlineOrders: "app.online_orders",
  activity: null,
  inventory: "app.inventory",
  shift: "app.shift.view_print",
  settings: "app.settings.view",
};

/**
 * Light App Permission helper for POS-kasir-mobile.
 * Fail-open when the signed-in user has no POS staff membership.
 */
export function usePosAppPermissions() {
  const acl = usePosStaffPermissions();

  const can = (key: string) => acl.can(key);

  const permissionKeySig = [...acl.permissionKeys].sort().join("|");

  const sidebarItems = useMemo(() => {
    return POS_SIDEBAR_ITEMS.filter((item) => {
      const key = POS_SIDEBAR_PERMISSION_KEY[item.id];
      if (!key) return true;
      return can(key);
    });
  }, [acl.unrestricted, permissionKeySig]);

  return {
    ...acl,
    can,
    sidebarItems,
    /** Gate ready for actions not yet in UI (refund, discount, etc.). */
    canCharge: () => can("app.pos.charge"),
    canManageOpenBills: () => can("app.pos.manage_open_bills"),
    canDiscount: () => can("app.pos.discounts"),
    canRefund: () => can("app.pos.refunds"),
    canVoid: () => can("app.pos.void_cancel"),
    canResendReceipt: () => can("app.pos.resend_receipt"),
    canViewShift: () => can("app.shift.view_print"),
    canCashMovement: () => can("app.shift.cash_movement"),
    canViewSettings: () => can("app.settings.view"),
    canEditSettings: () => can("app.settings.edit"),
    canEditCustomers: () => can("app.customers.edit"),
    canViewInventory: () => can("app.inventory"),
  };
}

export function filterPosSidebarItems(
  items: readonly PosSidebarItem[],
  can: (key: string) => boolean,
): PosSidebarItem[] {
  return items.filter((item) => {
    const key = POS_SIDEBAR_PERMISSION_KEY[item.id];
    if (!key) return true;
    return can(key);
  });
}
