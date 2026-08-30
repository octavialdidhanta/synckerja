import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  ClipboardList,
  Clock,
  CookingPot,
  LayoutGrid,
  Settings,
  Table2,
  Vault,
} from "lucide-react";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";

export type PosSidebarItemId =
  | "tableMap"
  | "pointOfSale"
  | "kitchen"
  | "onlineOrders"
  | "activity"
  | "inventory"
  | "shift"
  | "settings";

export type PosSidebarItem = {
  id: PosSidebarItemId;
  icon: LucideIcon;
  labelKey: string;
  labelFallback: string;
  path: string;
  /** When true, tap shows “coming soon” toast instead of navigating. */
  soon: boolean;
};

export const POS_SIDEBAR_ITEMS: readonly PosSidebarItem[] = [
  {
    id: "tableMap",
    icon: Table2,
    labelKey: POS_CASHIER_I18N.navTableMap,
    labelFallback: "Table Map",
    path: POS_AUTH_PATHS.tableMap,
    soon: false,
  },
  {
    id: "pointOfSale",
    icon: LayoutGrid,
    labelKey: POS_CASHIER_I18N.navPointOfSale,
    labelFallback: "Point of Sale",
    path: POS_AUTH_PATHS.cashier,
    soon: false,
  },
  {
    id: "kitchen",
    icon: CookingPot,
    labelKey: POS_CASHIER_I18N.navKitchen,
    labelFallback: "Kitchen Display",
    path: POS_AUTH_PATHS.kitchen,
    soon: false,
  },
  {
    id: "onlineOrders",
    icon: ClipboardList,
    labelKey: POS_CASHIER_I18N.navOnlineOrders,
    labelFallback: "Online Orders",
    path: POS_AUTH_PATHS.orders,
    soon: true,
  },
  {
    id: "activity",
    icon: Clock,
    labelKey: POS_CASHIER_I18N.navActivity,
    labelFallback: "Activity",
    path: POS_AUTH_PATHS.activity,
    soon: false,
  },
  {
    id: "inventory",
    icon: ClipboardCheck,
    labelKey: POS_CASHIER_I18N.navInventory,
    labelFallback: "Inventory",
    path: POS_AUTH_PATHS.inventory,
    soon: false,
  },
  {
    id: "shift",
    icon: Vault,
    labelKey: POS_CASHIER_I18N.navShift,
    labelFallback: "Shift",
    path: POS_AUTH_PATHS.shift,
    soon: false,
  },
  {
    id: "settings",
    icon: Settings,
    labelKey: POS_CASHIER_I18N.navSettings,
    labelFallback: "Settings",
    path: POS_AUTH_PATHS.settings,
    soon: false,
  },
] as const;
