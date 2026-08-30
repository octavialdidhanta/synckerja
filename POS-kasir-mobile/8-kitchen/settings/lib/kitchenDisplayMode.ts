export type KitchenDisplayMode = "classic" | "tiled";

export function isKitchenDisplayMode(value: unknown): value is KitchenDisplayMode {
  return value === "classic" || value === "tiled";
}
