import { KITCHEN_SALES_TYPE_BUCKETS } from "../../lib/kitchenSalesTypeBucket";
import {
  DEFAULT_KITCHEN_FONT_SIZE,
  DEFAULT_KITCHEN_THEME_COLORS,
  KITCHEN_FONT_SIZES,
  type KitchenFontSize,
  type KitchenThemeColors,
} from "./defaultKitchenTheme";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidKitchenHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeKitchenHex(value: string): string | null {
  const raw = value.trim();
  if (!isValidKitchenHex(raw)) return null;
  return raw.toLowerCase();
}

export function isKitchenFontSize(value: unknown): value is KitchenFontSize {
  return (
    typeof value === "string" &&
    (KITCHEN_FONT_SIZES as readonly string[]).includes(value)
  );
}

export function parseKitchenFontSize(raw: unknown): KitchenFontSize {
  return isKitchenFontSize(raw) ? raw : DEFAULT_KITCHEN_FONT_SIZE;
}

export function parseKitchenThemeColors(raw: unknown): KitchenThemeColors {
  const base: KitchenThemeColors = {
    order_types: { ...DEFAULT_KITCHEN_THEME_COLORS.order_types },
    status: { ...DEFAULT_KITCHEN_THEME_COLORS.status },
  };
  if (!raw || typeof raw !== "object") return base;

  const obj = raw as {
    order_types?: Record<string, unknown>;
    status?: Record<string, unknown>;
  };

  if (obj.order_types && typeof obj.order_types === "object") {
    for (const key of KITCHEN_SALES_TYPE_BUCKETS) {
      const hex = normalizeKitchenHex(String(obj.order_types[key] ?? ""));
      if (hex) base.order_types[key] = hex;
    }
  }

  if (obj.status && typeof obj.status === "object") {
    for (const key of ["on_time", "caution", "late"] as const) {
      const hex = normalizeKitchenHex(String(obj.status[key] ?? ""));
      if (hex) base.status[key] = hex;
    }
  }

  return base;
}

export function kitchenThemeColorsEqual(
  a: KitchenThemeColors,
  b: KitchenThemeColors,
): boolean {
  for (const key of KITCHEN_SALES_TYPE_BUCKETS) {
    if (a.order_types[key] !== b.order_types[key]) return false;
  }
  return (
    a.status.on_time === b.status.on_time &&
    a.status.caution === b.status.caution &&
    a.status.late === b.status.late
  );
}
