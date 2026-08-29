export type InventoryPoPurchaseType = "Inventory" | "Inventory Item";

export function inventoryPoPurchaseType(
  itemKind: "product" | "ingredient",
): InventoryPoPurchaseType {
  return itemKind === "product" ? "Inventory Item" : "Inventory";
}

export function isInventoryPurchaseType(purchaseType: string | null | undefined): boolean {
  const value = String(purchaseType ?? "").trim().toLowerCase();
  return value === "inventory" || value === "inventory item";
}
