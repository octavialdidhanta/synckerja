import type { KitchenSalesTypeBucket } from "./kitchenSalesTypeBucket";
import { resolveKitchenSalesTypeBucket } from "./kitchenSalesTypeBucket";

export type KitchenFireTrigger = "save_bill" | "on_pay";

export type KitchenFireBySalesType = Record<KitchenSalesTypeBucket, KitchenFireTrigger>;

export const KITCHEN_FIRE_TRIGGERS: readonly KitchenFireTrigger[] = [
  "save_bill",
  "on_pay",
] as const;

export const DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE: KitchenFireBySalesType = {
  dine_in: "save_bill",
  takeaway: "on_pay",
  delivery: "on_pay",
  pickup: "on_pay",
};

export function isKitchenFireTrigger(value: unknown): value is KitchenFireTrigger {
  return value === "save_bill" || value === "on_pay";
}

export function parseKitchenFireBySalesType(raw: unknown): KitchenFireBySalesType {
  const out = { ...DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const bucket of Object.keys(DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE) as KitchenSalesTypeBucket[]) {
    const v = obj[bucket];
    if (isKitchenFireTrigger(v)) out[bucket] = v;
  }
  return out;
}

export function resolveKitchenFireTrigger(
  salesTypeLabel: string | null | undefined,
  settings: KitchenFireBySalesType,
): KitchenFireTrigger {
  const bucket = resolveKitchenSalesTypeBucket(salesTypeLabel);
  return settings[bucket] ?? DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE[bucket];
}

export function shouldFireKitchen(args: {
  event: KitchenFireTrigger;
  salesTypeLabel: string | null | undefined;
  settings: KitchenFireBySalesType;
}): boolean {
  return resolveKitchenFireTrigger(args.salesTypeLabel, args.settings) === args.event;
}

/**
 * On pay: fire when policy is on_pay, OR pay-first with no prior KDS fire
 * (walk-in / direct pay even if dine_in default is save_bill).
 */
export function shouldFireKitchenOnPay(args: {
  salesTypeLabel: string | null | undefined;
  settings: KitchenFireBySalesType;
  hadKitchenTicketsBeforePay: boolean;
}): boolean {
  if (shouldFireKitchen({ event: "on_pay", salesTypeLabel: args.salesTypeLabel, settings: args.settings })) {
    return true;
  }
  if (args.hadKitchenTicketsBeforePay) return false;
  return shouldFireKitchen({
    event: "save_bill",
    salesTypeLabel: args.salesTypeLabel,
    settings: args.settings,
  });
}

export function kitchenFirePolicyEqual(
  a: KitchenFireBySalesType,
  b: KitchenFireBySalesType,
): boolean {
  return (
    a.dine_in === b.dine_in &&
    a.takeaway === b.takeaway &&
    a.delivery === b.delivery &&
    a.pickup === b.pickup
  );
}
