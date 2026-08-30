import type { PosFloorFixtureType } from "./posFloorFixtureTypes";
import { fixtureTypeFallback } from "./fixtureVisuals";

/** Build next unique name like "Door", "Door 2" from existing labels. */
export function nextFixtureName(
  type: PosFloorFixtureType,
  existingNames: string[],
  labelForType: string = fixtureTypeFallback(type),
): string {
  const base = labelForType.trim() || fixtureTypeFallback(type);
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}
