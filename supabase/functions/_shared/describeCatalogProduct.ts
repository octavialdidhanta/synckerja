/** Pure rules for the product-photo draft. The edge function calls Gemini; this file does not. */

export const FIELD_BODY_MAX = 4000;

export const FALLBACK_MENU_FIELDS: { key: string; label: string; position: number }[] = [
  { key: "main", label: "Main Subject", position: 1 },
  { key: "topping", label: "Signature Topping", position: 2 },
  { key: "garnish", label: "Side Garnishes", position: 3 },
  { key: "presentation", label: "Presentation", position: 4 },
  { key: "sauce", label: "Dipping Sauce", position: 5 },
  { key: "larangan", label: "Larangan (must NOT)", position: 6 },
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

/** Reference photo first, then the Item Library photo, then the content-plan subcategory photo. */
export function pickPhoto(
  catalogPaths: Array<string | null | undefined>,
  itemPath: string | null | undefined,
  subcategoryPath?: string | null,
): PhotoChoice | null {
  const catalog = catalogPaths.map((path) => (path ?? "").trim()).find(Boolean);
  if (catalog) return { bucket: "catalog-media", path: catalog };
  const item = (itemPath ?? "").trim();
  if (item) return { bucket: "catalog-product-photos", path: item };
  const subcategory = (subcategoryPath ?? "").trim();
  if (subcategory) return { bucket: "sub-service-photos", path: subcategory };
  return null;
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
