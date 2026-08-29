import type { InventoryFeatureAccessRow, InventoryFeatureKey, InventoryUserRole } from "../types";

export const PO_FEATURE_KEYS: InventoryFeatureKey[] = [
  "po_request",
  "po_approval",
  "po_fulfillment",
];

export const TRANSFER_FEATURE_KEYS: InventoryFeatureKey[] = [
  "transfer_request",
  "transfer_approval",
  "transfer_shipment",
  "transfer_fulfillment",
];

export const DEFAULT_ADVANCED_ROLES: InventoryUserRole[] = ["owner", "admin"];

export function buildDefaultFeatureAccess(
  poMode: "simple" | "advanced",
  transferMode: "simple" | "advanced",
): InventoryFeatureAccessRow[] {
  const rows: InventoryFeatureAccessRow[] = [];
  if (poMode === "advanced") {
    for (const key of PO_FEATURE_KEYS) {
      rows.push({ feature_key: key, allowed_roles: [...DEFAULT_ADVANCED_ROLES] });
    }
  }
  if (transferMode === "advanced") {
    for (const key of TRANSFER_FEATURE_KEYS) {
      rows.push({ feature_key: key, allowed_roles: [...DEFAULT_ADVANCED_ROLES] });
    }
  }
  return rows;
}

export function mergeFeatureAccess(
  existing: InventoryFeatureAccessRow[],
  poMode: "simple" | "advanced",
  transferMode: "simple" | "advanced",
): InventoryFeatureAccessRow[] {
  const map = new Map(existing.map((row) => [row.feature_key, row]));
  const requiredKeys: InventoryFeatureKey[] = [
    ...(poMode === "advanced" ? PO_FEATURE_KEYS : []),
    ...(transferMode === "advanced" ? TRANSFER_FEATURE_KEYS : []),
  ];

  return requiredKeys.map((key) => {
    const current = map.get(key);
    if (current && current.allowed_roles.length > 0) return current;
    return { feature_key: key, allowed_roles: [...DEFAULT_ADVANCED_ROLES] };
  });
}

export function featureAccessLabelKey(featureKey: InventoryFeatureKey): string {
  return `settings.inventory.features.${featureKey}`;
}

export function roleLabelKey(role: InventoryUserRole): string {
  return `settings.inventory.roles.${role}`;
}
