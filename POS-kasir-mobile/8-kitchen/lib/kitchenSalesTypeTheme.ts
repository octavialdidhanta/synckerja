import type { KitchenSalesTypeBucket } from "./kitchenSalesTypeBucket";
import { resolveKitchenSalesTypeBucket } from "./kitchenSalesTypeBucket";
import type { KitchenThemeColors } from "../settings/lib/defaultKitchenTheme";
import { DEFAULT_KITCHEN_THEME_COLORS } from "../settings/lib/defaultKitchenTheme";

export type KitchenSalesTypeTheme = {
  headerBg: string;
  headerBgHex: string;
  headerIcon: string;
  ringAccent: string;
};

const ICON_BY_BUCKET: Record<KitchenSalesTypeBucket, string> = {
  dine_in: "text-indigo-900",
  takeaway: "text-sky-900",
  delivery: "text-violet-900",
  pickup: "text-emerald-800",
};

/** Header colors by sales-type label; optional outlet theme overrides. */
export function resolveKitchenSalesTypeTheme(
  label: string | null | undefined,
  orderTypeColors?: KitchenThemeColors["order_types"],
): KitchenSalesTypeTheme {
  const bucket = resolveKitchenSalesTypeBucket(label);
  const colors = orderTypeColors ?? DEFAULT_KITCHEN_THEME_COLORS.order_types;
  const hex = colors[bucket] ?? DEFAULT_KITCHEN_THEME_COLORS.order_types[bucket];
  return {
    headerBg: "",
    headerBgHex: hex,
    headerIcon: ICON_BY_BUCKET[bucket],
    ringAccent: hex,
  };
}

export function formatKitchenSalesTypeTitle(
  label: string | null | undefined,
  fallback: string,
): string {
  const raw = (label ?? "").trim() || fallback;
  return raw.toUpperCase();
}
