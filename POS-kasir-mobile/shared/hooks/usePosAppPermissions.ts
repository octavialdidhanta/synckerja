import { useMemo } from "react";
import { usePosStaffPermissions } from "@/8-2-8-employees-staff/hooks/usePosStaffPermissions";
import {
  POS_SIDEBAR_ITEMS,
  type PosSidebarItem,
  type PosSidebarItemId,
} from "@/pos-mobile/2-cashier/components/sidebar/posSidebarItems";
import { resolvePosAppCan } from "./resolvePosAppCan";

const APP_POS_CHARGE = "app.pos.charge";
const APP_KITCHEN_DISPLAY = "app.kitchen_display";

/** Map POS mobile sidebar entries → App Permission keys (null = always show). */
export const POS_SIDEBAR_PERMISSION_KEY: Record<PosSidebarItemId, string | null> = {
  tableMap: "app.table_map",
  pointOfSale: APP_POS_CHARGE,
  kitchen: APP_KITCHEN_DISPLAY,
  onlineOrders: "app.online_orders",
  /** Kitchen-only staff must not see Activity. */
  activity: APP_POS_CHARGE,
  inventory: "app.inventory",
  shift: "app.shift.view_print",
  settings: "app.settings.view",
};

/**
 * Light App Permission helper for POS-kasir-mobile.
 * Fail-closed: staff role keys only. Office Owner/Admin `unrestricted` does not
 * grant tablet features (e.g. KDS) without `app.kitchen_display` on the staff role.
 */
export function usePosAppPermissions() {
  const acl = usePosStaffPermissions();

  const can = (key: string) =>
    resolvePosAppCan(
      {
        isLoading: acl.isLoading,
        hasStaffMembership: acl.hasStaffMembership,
        permissionKeys: acl.permissionKeys,
      },
      key,
    );

  const permissionKeySig = [...acl.permissionKeys].sort().join("|");

  const sidebarItems = useMemo(() => {
    return POS_SIDEBAR_ITEMS.filter((item) => {
      const key = POS_SIDEBAR_PERMISSION_KEY[item.id];
      if (!key) return true;
      return can(key);
    });
  }, [acl.isLoading, acl.hasStaffMembership, permissionKeySig]);

  return {
    ...acl,
    can,
    sidebarItems,
    canCharge: () => can(APP_POS_CHARGE),
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
    canKitchenDisplay: () => can(APP_KITCHEN_DISPLAY),
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
