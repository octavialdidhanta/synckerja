export type IngredientUnit = {
  code: string;
  name: string;
};

export const INGREDIENT_UNITS: IngredientUnit[] = [
  { code: "pcs", name: "pieces" },
  { code: "box", name: "box" },
  { code: "bks", name: "bungkus" },
  { code: "btr", name: "butir" },
  { code: "cm", name: "centimeter" },
  { code: "c", name: "cup" },
  { code: "ekr", name: "ekor" },
  { code: "fl oz", name: "fluid ounce" },
  { code: "gal", name: "gallon" },
  { code: "g", name: "gram" },
  { code: "grs", name: "gros" },
  { code: "ikt", name: "ikat" },
  { code: "in", name: "inch" },
  { code: "jar", name: "jar" },
  { code: "klg", name: "kaleng" },
  { code: "kds", name: "kardus" },
  { code: "ktn", name: "karton" },
  { code: "krg", name: "karung" },
  { code: "kg", name: "kilogram" },
  { code: "crt", name: "krat" },
  { code: "kw", name: "kwintal" },
  { code: "lbr", name: "lembar" },
  { code: "l", name: "litre" },
  { code: "lsn", name: "lusin" },
  { code: "m", name: "meter" },
  { code: "mg", name: "milligram" },
  { code: "ml", name: "millilitre" },
  { code: "ons", name: "ons" },
  { code: "oz", name: "ounce" },
  { code: "pck", name: "pack" },
  { code: "pt", name: "pint" },
  { code: "prs", name: "portion" },
  { code: "ptg", name: "potong" },
  { code: "lb", name: "pound" },
  { code: "q", name: "quart" },
  { code: "sct", name: "sachet" },
  { code: "tbsp", name: "tablespoon" },
  { code: "tsp", name: "teaspoon" },
  { code: "tn", name: "ton" },
  { code: "whole", name: "whole" },
];

export const DEFAULT_INGREDIENT_UNIT_CODE = "pcs";

export function formatIngredientUnit(unit: IngredientUnit): string {
  return `${unit.name} (${unit.code})`;
}

export function findIngredientUnit(code: string): IngredientUnit | undefined {
  return INGREDIENT_UNITS.find((unit) => unit.code === code);
}

export function formatIngredientUnitCode(code: string): string {
  const unit = findIngredientUnit(code);
  return unit ? formatIngredientUnit(unit) : code;
}
