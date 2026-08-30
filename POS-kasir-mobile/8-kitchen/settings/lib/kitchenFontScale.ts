import type { KitchenFontSize } from "./defaultKitchenTheme";

/** Relative scales — spaced enough to see on KDS cards. */
const SCALES: Record<KitchenFontSize, number> = {
  small: 0.85,
  default: 1,
  medium: 1.2,
  large: 1.4,
};

export function kitchenFontScale(size: KitchenFontSize): number {
  return SCALES[size] ?? 1;
}
