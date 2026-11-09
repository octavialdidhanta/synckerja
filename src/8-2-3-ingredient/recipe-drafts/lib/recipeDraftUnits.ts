/**
 * Unit handling for recipe draft editing. Recipe quantities are stored in each ingredient's own
 * unit (catalog_ingredients.unit_code). People type in the unit they think in (g, ml), so mass and
 * volume ingredients get a small/large unit choice and everything is converted back on save.
 */

const MASS: Record<string, number> = { mg: 0.000001, g: 0.001, ons: 0.1, kg: 1 };
const VOLUME: Record<string, number> = { ml: 0.001, l: 1 };

export type UnitFamily = "mass" | "volume" | "other";

export function unitFamily(unitCode: string | null | undefined): UnitFamily {
  const code = (unitCode ?? "").toLowerCase();
  if (code in MASS) return "mass";
  if (code in VOLUME) return "volume";
  return "other";
}

/** Units offered next to the quantity input. "other" units have only their own code. */
export function inputUnitOptions(unitCode: string | null | undefined): string[] {
  const family = unitFamily(unitCode);
  if (family === "mass") return ["g", "kg"];
  if (family === "volume") return ["ml", "l"];
  return [unitCode ?? ""];
}

function factor(unit: string): number | null {
  const code = unit.toLowerCase();
  if (code in MASS) return MASS[code];
  if (code in VOLUME) return VOLUME[code];
  return null;
}

/** Convert a quantity typed in `fromUnit` to the ingredient's unit. Returns null across families. */
export function convertToIngredientUnit(qty: number, fromUnit: string, ingredientUnit: string): number | null {
  if (fromUnit.toLowerCase() === ingredientUnit.toLowerCase()) return qty;
  if (unitFamily(fromUnit) !== unitFamily(ingredientUnit) || unitFamily(fromUnit) === "other") return null;
  const from = factor(fromUnit);
  const to = factor(ingredientUnit);
  if (from == null || to == null) return null;
  return (qty * from) / to;
}

/** Recipe lines hold 3 decimals (numeric(14,3)). */
export function roundRecipeQty(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

/** Pick the unit a person would naturally read: 150 g rather than 0,15 kg. */
export function naturalInput(qty: number, ingredientUnit: string): { value: number; unit: string } {
  const family = unitFamily(ingredientUnit);
  if (family === "other") return { value: qty, unit: ingredientUnit };
  const small = family === "mass" ? "g" : "ml";
  const large = family === "mass" ? "kg" : "l";
  const inLarge = convertToIngredientUnit(qty, ingredientUnit, large) ?? qty;
  if (inLarge < 1) {
    return { value: convertToIngredientUnit(qty, ingredientUnit, small) ?? qty, unit: small };
  }
  return { value: inLarge, unit: large };
}

export function formatQty(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

/** "150 g" for 0.15 kg; the stored unit is shown separately when it differs. */
export function friendlyQty(qty: number | null | undefined, ingredientUnit: string | null | undefined): string {
  if (qty == null) return "—";
  const unit = ingredientUnit ?? "";
  const natural = naturalInput(qty, unit);
  return `${formatQty(natural.value)} ${natural.unit}`.trim();
}

export function storedQty(qty: number | null | undefined, ingredientUnit: string | null | undefined): string | null {
  if (qty == null || !ingredientUnit) return null;
  const natural = naturalInput(qty, ingredientUnit);
  if (natural.unit.toLowerCase() === ingredientUnit.toLowerCase()) return null;
  return `${formatQty(qty)} ${ingredientUnit}`;
}

/** Parse what a person typed: accepts "1,5" and "1.5". */
export function parseQtyInput(raw: string): number | null {
  const text = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!text) return null;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
