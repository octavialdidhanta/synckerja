import type { KitchenSalesTypeBucket } from "../../lib/kitchenSalesTypeBucket";
import type {
  KitchenFontSize,
  KitchenThemeColors,
} from "./defaultKitchenTheme";
import {
  DEFAULT_KITCHEN_FONT_SIZE,
  DEFAULT_KITCHEN_THEME_COLORS,
} from "./defaultKitchenTheme";
import {
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  type KitchenFireBySalesType,
} from "../../lib/kitchenFirePolicy";

export type KitchenDisplayMode = "classic" | "tiled";

export type KitchenOrderTypeVisibility = Record<KitchenSalesTypeBucket, boolean>;

export type PosKitchenOutletSettings = {
  id: string | null;
  organization_id: string;
  outlet_id: string;
  display_mode: KitchenDisplayMode;
  order_type_visibility: KitchenOrderTypeVisibility;
  font_size: KitchenFontSize;
  colors: KitchenThemeColors;
  kitchen_fire_by_sales_type: KitchenFireBySalesType;
};

export const DEFAULT_ORDER_TYPE_VISIBILITY: KitchenOrderTypeVisibility = {
  dine_in: true,
  takeaway: true,
  delivery: true,
  pickup: true,
};

export const DEFAULT_KITCHEN_DISPLAY_MODE: KitchenDisplayMode = "classic";

export { DEFAULT_KITCHEN_FONT_SIZE, DEFAULT_KITCHEN_THEME_COLORS };
export { DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE };

export const POS_KITCHEN_OUTLET_SETTINGS_QUERY_KEY = "pos-kitchen-outlet-settings";

export type KitchenSettingsTabId =
  | "display_modes"
  | "transition_times"
  | "fonts_colors"
  | "assign_store";
