/** Pure rules for the product-photo draft. The edge function calls Gemini; this file does not. */

export const FIELD_BODY_MAX = 4000;

export const FALLBACK_MENU_FIELDS: { key: string; label: string; position: number }[] = [
  { key: "main", label: "Hidangan utama", position: 1 },
  { key: "topping", label: "Topping khas", position: 2 },
  { key: "garnish", label: "Pelengkap", position: 3 },
  { key: "presentation", label: "Penyajian", position: 4 },
  { key: "sauce", label: "Saus", position: 5 },
  { key: "larangan", label: "Larangan", position: 6 },
  { key: "khusus", label: "Aturan khusus", position: 7 },
];

export type TemplateField = { key: string; label: string; position: number };

export function templateFields(defs: TemplateField[] | null | undefined): TemplateField[] {
  if (!defs || defs.length === 0) return FALLBACK_MENU_FIELDS;
  return [...defs]
    .filter((field) => field.key.trim() && field.label.trim())
    .sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));
}

export function geminiModel(stored: string | null | undefined): string {
  const name = (stored ?? "").trim();
  return name.startsWith("gemini-") ? name : "gemini-2.5-flash";
}

const INDONESIAN = ["yang", "dan", "dengan", "dari", "untuk", "tidak", "atau", "ini", "pada", "adalah"];
const ENGLISH = ["the", "and", "with", "from", "for", "not", "this", "that", "of", "is"];

/** Match a filled column. An empty product is described in Indonesian. */
export function draftLanguage(bodies: string[]): "id" | "en" {
  const words = bodies.join(" ").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length === 0) return "id";
  let indonesian = 0;
  let english = 0;
  for (const word of words) {
    if (INDONESIAN.includes(word)) indonesian += 1;
    if (ENGLISH.includes(word)) english += 1;
  }
  return english > indonesian ? "en" : "id";
}

export type PhotoChoice = { bucket: "catalog-media" | "catalog-product-photos" | "sub-service-photos"; path: string };

const TRAILING_PRICE_NOTE = /\s*\((?:rp\s*\d[\d.]*(?:[.,]\d+)?|\d[\d.]*(?:[.,]\d+)?\s*(?:k|rb))\s*\)\s*$/i;

/** Compare catalog names without letter case or a trailing price note such as `(80K)`. `(Lbs)` stays. */
export function catalogNameKey(value: string): string {
  return value.trim().toLowerCase().replace(TRAILING_PRICE_NOTE, "").trim();
}

export type LookSubcategory = {
  name: string;
  imagePath: string | null;
  catalogProductId: string | null;
};

/**
 * The subcategory the product page would use by name.
 * A linked menu does not match by name. A subcategory already tied to an item,
 * or whose name matches an Item Library product, does not count.
 * Several matches use the first name, the same order as the page query.
 */
export function matchSubcategoryPhoto(input: {
  menuName: string;
  linked: boolean;
  items: Array<{ name: string }>;
  subcategories: LookSubcategory[];
}): { name: string; imagePath: string | null } | null {
  if (input.linked) return null;
  const key = catalogNameKey(input.menuName);
  if (!key) return null;
  const productKeys = new Set(input.items.map((row) => catalogNameKey(row.name)).filter(Boolean));
  const match = input.subcategories
    .filter((row) => !row.catalogProductId)
    .filter((row) => {
      const nameKey = catalogNameKey(row.name);
      return Boolean(nameKey) && !productKeys.has(nameKey) && nameKey === key;
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))[0];
  if (!match) return null;
  const imagePath = (match.imagePath ?? "").trim();
  return { name: match.name, imagePath: imagePath || null };
}

/** Item Library photo, then the subcategory photo, then the first uploaded reference photo. */
export function pickPhoto(
  catalogPaths: Array<string | null | undefined>,
  itemPath: string | null | undefined,
  subcategoryPath?: string | null,
): PhotoChoice | null {
  const item = (itemPath ?? "").trim();
  if (item) return { bucket: "catalog-product-photos", path: item };
  const subcategory = (subcategoryPath ?? "").trim();
  if (subcategory) return { bucket: "sub-service-photos", path: subcategory };
  const catalog = catalogPaths.map((path) => (path ?? "").trim()).find(Boolean);
  if (catalog) return { bucket: "catalog-media", path: catalog };
  return null;
}

export type ProductLookInput = {
  menuName: string;
  defaultPriceId: string | null;
  featureId: string | null;
  subServiceId: string | null;
  /** Ignored unless this menu is linked to that Item Library row. */
  itemPath: string | null;
  /** Ignored unless this menu is linked to that subcategory. */
  linkedSubcategoryPath: string | null;
  items: Array<{ name: string }>;
  subcategories: LookSubcategory[];
  catalogPaths: Array<string | null | undefined>;
};

/** One appearance photo. A set id blocks name matching. An empty linked file falls through to the reference photo. */
export function resolveProductLook(input: ProductLookInput): PhotoChoice | null {
  const linked = Boolean(input.defaultPriceId || input.featureId || input.subServiceId);
  let itemPath: string | null = null;
  let subcategoryPath: string | null = null;
  if (input.defaultPriceId) {
    itemPath = input.itemPath;
  } else if (input.subServiceId) {
    subcategoryPath = input.linkedSubcategoryPath;
  } else if (!linked) {
    subcategoryPath = matchSubcategoryPhoto({
      menuName: input.menuName,
      linked: false,
      items: input.items,
      subcategories: input.subcategories,
    })?.imagePath ?? null;
  }
  return pickPhoto(input.catalogPaths, itemPath, subcategoryPath);
}

export function buildDescribePrompt(input: { name: string; fields: TemplateField[]; language: "id" | "en" }): string {
  const language = input.language === "en"
    ? "Write every field in English."
    : "Tulis setiap kolom dalam Bahasa Indonesia.";
  const lines = input.fields.map((field) => `- ${field.key}: ${field.label}`).join("\n");
  return [
    `Product name: ${input.name}`,
    "Look at the photo. Describe only what is visible, plus the product name.",
    "Do not invent a price, a stock count, a recipe, or a claim the photo does not show.",
    "Omit a field when the photo does not show it.",
    language,
    "Return JSON only, with this shape: {\"fields\": {\"key\": \"text\"}}.",
    `Each text is at most ${FIELD_BODY_MAX} characters.`,
    "Fields:",
    lines,
  ].join("\n");
}

/** Unknown keys and empty text are dropped. Nothing here is written to the database. */
export function parseDraftFields(raw: string, allowed: string[]): Record<string, string> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const fields = record && record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
    ? record.fields as Record<string, unknown>
    : record;
  if (!fields) return {};
  const allow = new Set(allowed);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!allow.has(key)) continue;
    const body = String(value ?? "").trim().slice(0, FIELD_BODY_MAX);
    if (!body) continue;
    out[key] = body;
  }
  return out;
}
