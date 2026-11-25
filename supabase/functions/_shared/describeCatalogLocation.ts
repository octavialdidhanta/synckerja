/** Pure rules for the location-photo draft. The edge function calls Gemini; this file does not. */

export const LOCATION_TEXT_MAX = 4000;

export const LOCATION_DRAFT_FIELDS: { key: "desc" | "scene" | "atmosphere" | "must_not"; label: string }[] = [
  { key: "desc", label: "what the camera sees in this photo" },
  { key: "scene", label: "the place as a whole, only what this photo shows" },
  { key: "atmosphere", label: "light and mood of the place" },
  { key: "must_not", label: "what must not appear, only when the photo itself shows that restriction" },
];

/** Titles the Flow prompt already prints. Scene is matched by this exact word. */
export const LOCATION_ALWAYS_ON: { key: "scene" | "atmosphere" | "must_not"; title: string }[] = [
  { key: "scene", title: "Scene" },
  { key: "atmosphere", title: "Atmosphere" },
  { key: "must_not", title: "Must NOT" },
];

export function buildLocationDescribePrompt(input: {
  name: string;
  photoLabel: string;
  language: "id" | "en";
}): string {
  const language = input.language === "en"
    ? "Write every field in English."
    : "Tulis setiap kolom dalam Bahasa Indonesia.";
  const lines = LOCATION_DRAFT_FIELDS.map((field) => `- ${field.key}: ${field.label}`).join("\n");
  return [
    `Location: ${input.name}`,
    `Photo: ${input.photoLabel}`,
    "Look at this photo of the place. Describe only what is visible.",
    "Do not invent a price, a stock count, a recipe, a person, or an object the photo does not show.",
    "Omit a field when the photo does not show it.",
    language,
    'Return JSON only, with this shape: {"fields": {"desc": "text", "scene": "text", "atmosphere": "text", "must_not": "text"}}.',
    `Each text is at most ${LOCATION_TEXT_MAX} characters.`,
    "Fields:",
    lines,
  ].join("\n");
}
