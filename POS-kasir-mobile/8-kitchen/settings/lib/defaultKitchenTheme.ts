import type { KitchenSalesTypeBucket } from "../../lib/kitchenSalesTypeBucket";

export type KitchenFontSize = "default" | "small" | "medium" | "large";

export type KitchenStatusColorKey = "on_time" | "caution" | "late";

export type KitchenThemeColors = {
  order_types: Record<KitchenSalesTypeBucket, string>;
  status: Record<KitchenStatusColorKey, string>;
};

export const DEFAULT_KITCHEN_FONT_SIZE: KitchenFontSize = "default";

export const DEFAULT_KITCHEN_THEME_COLORS: KitchenThemeColors = {
  order_types: {
    dine_in: "#9fb6ff",
    takeaway: "#84b4e3",
    delivery: "#9374e1",
    pickup: "#9fdb60",
  },
  status: {
    on_time: "#14b768",
    caution: "#fdc200",
    late: "#d0021b",
  },
};

export const KITCHEN_FONT_SIZES: readonly KitchenFontSize[] = [
  "default",
  "small",
  "medium",
  "large",
] as const;
