/**
 * Canva brief for Design Story (one Instagram Story 9:16 frame).
 * Separate from canvaCarouselBrief — do not branch carousel with isStory.
 */

export const BRIEF_LIMIT_FULL = 4200;
export const BRIEF_LIMIT_SHORT = 3000;
export const STORY_BRIEF_LIMIT_FULL = BRIEF_LIMIT_FULL;
export const STORY_BRIEF_LIMIT_SHORT = BRIEF_LIMIT_SHORT;

export type CatalogPalette = {
  primary: string;
  secondary: string;
  accent: string;
};

export type StoryBriefFields = {
  format: string;
  headline: string;
  visual: string;
  concept: string;
  palette: CatalogPalette | null;
  fonts: { headline: string; body: string } | null;
};

const SEQUENCE_COMMENT = /<!--\s*synckerja-brief-sequences:[\s\S]*?-->/gi;
const HEX = /^#[0-9a-f]{6}$/;

function clip(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function lineValue(brief: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = brief.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
  return match ? clip(match[1], 800) : "";
}

function hex(value: string): string {
  const text = value.trim().toLowerCase();
  return HEX.test(text) ? text : "";
}

function paletteFromBrief(brief: string): CatalogPalette | null {
  const colorLine = brief.match(/^Warna:\s*(.+)$/im)?.[1] ?? "";
  if (!colorLine) return null;
  const primary = hex(colorLine.match(/primer\s+(#[0-9a-fA-F]{6})/i)?.[1] ?? "");
  const secondary = hex(colorLine.match(/sekunder\s+(#[0-9a-fA-F]{6})/i)?.[1] ?? "");
  const accent = hex(colorLine.match(/aksen\s+(#[0-9a-fA-F]{6})/i)?.[1] ?? "");
  if (!primary || !secondary || !accent) return null;
  return { primary, secondary, accent };
}

function fontsFromBrief(brief: string): StoryBriefFields["fonts"] {
  const fontLine = brief.match(/^Font:\s*(.+)$/im)?.[1] ?? "";
  if (!fontLine) return null;
  const headlineFont = clip(fontLine.match(/headline\s+([^,]+)/i)?.[1] ?? "", 60);
  const bodyFont = clip(fontLine.match(/body\s+(.+)$/i)?.[1] ?? "", 60);
  if (!headlineFont && !bodyFont) return null;
  if (headlineFont.toLowerCase() === "default" && bodyFont.toLowerCase() === "default") return null;
  return {
    headline: headlineFont.toLowerCase() === "default" ? "" : headlineFont,
    body: bodyFont.toLowerCase() === "default" ? "" : bodyFont,
  };
}

/** Parse packed Story brief from ai_employee_story_fields. */
export function parseStoryBriefFields(briefMarkdown: string): StoryBriefFields {
  const brief = String(briefMarkdown ?? "").replace(SEQUENCE_COMMENT, "").trim();
  const headlineRaw = lineValue(brief, "Headline");
  const headline = headlineRaw === "—" ? "" : headlineRaw;
  return {
    format: lineValue(brief, "Format") || "Instagram Story 9:16 (satu frame)",
    headline,
    visual: lineValue(brief, "Visual"),
    concept: lineValue(brief, "Concept"),
    palette: paletteFromBrief(brief),
    fonts: fontsFromBrief(brief),
  };
}

export function storyBriefReady(fields: StoryBriefFields): boolean {
  return Boolean(fields.visual.trim() || fields.concept.trim());
}

const ALLOWED_BRAND_FONTS = new Set([
  "Montserrat",
  "Poppins",
  "Open Sans",
  "Lato",
  "Roboto",
  "Nunito",
  "Raleway",
  "Oswald",
  "Playfair Display",
  "Source Sans 3",
  "Inter",
  "Merriweather",
  "DM Sans",
  "Bebas Neue",
]);

function normalizeBrandFont(name?: string | null): string {
  const value = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return ALLOWED_BRAND_FONTS.has(value) ? value : "";
}

function typeLine(fonts?: { headline?: string | null; body?: string | null } | null): string {
  const headline = normalizeBrandFont(fonts?.headline);
  const body = normalizeBrandFont(fonts?.body);
  if (!headline && !body) {
    return "Use one headline font and one body font for all text on this story. Headline is the largest text.";
  }
  if (headline && body) {
    return `Headline text uses the Canva font "${headline}". Supporting text uses the Canva font "${body}". Headline is the largest text.`;
  }
  if (headline) {
    return `Headline text uses the Canva font "${headline}". Supporting text uses one consistent complementary font. Headline is the largest text.`;
  }
  return `Supporting text uses the Canva font "${body}". Headline uses one consistent complementary font. Headline is the largest text.`;
}

function paletteLine(palette?: CatalogPalette | null): string {
  if (!palette) return "";
  return `Color palette: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}. Use these as the main brand colors.`;
}

export function buildCanvaStoryBrief(
  input: {
    title: string;
    caption?: string;
    fields: StoryBriefFields;
    fonts?: { headline?: string | null; body?: string | null } | null;
    requiredNote?: string;
    forbiddenNote?: string;
  },
  options?: { limit?: number },
): string {
  const limitChars = options?.limit ?? BRIEF_LIMIT_FULL;
  const title = clip(input.title, 200) || "Story";
  const caption = clip(input.caption, 400);
  const forbiddenNote = clip(input.forbiddenNote, 500);
  const requiredNote = clip(input.requiredNote, 500);
  const mergedFonts = {
    headline: input.fonts?.headline || input.fields.fonts?.headline || null,
    body: input.fonts?.body || input.fields.fonts?.body || null,
  };
  const captionLine = caption ? ` Optional archive caption (not the main visual): ${caption}` : "";
  const assemble = (visualMax: number, conceptMax: number) => [
    "Create ONE Instagram Story design (portrait 9:16, 1080x1920). Single page only — not a carousel, not a feed post.",
    clip(input.fields.format, 120) ? `Format: ${clip(input.fields.format, 120)}.` : "",
    "Full-bleed visual fills the frame. Large headline overlay, readable on mobile in one glance.",
    "No multi-page sequence. No feed caption block as the main visual. No carousel indicators.",
    paletteLine(input.fields.palette),
    typeLine(mergedFonts),
    requiredNote ? `Must include or respect: ${requiredNote}` : "",
    forbiddenNote ? `Do not write or show any of this: ${forbiddenNote}` : "",
    `Working title: ${title}.${captionLine}`,
    input.fields.headline ? `On-screen headline (largest text): ${clip(input.fields.headline, 160)}.` : "",
    input.fields.visual ? `Visual / scene: ${clip(input.fields.visual, visualMax)}.` : "",
    input.fields.concept ? `Creative intent (do not print as body copy): ${clip(input.fields.concept, conceptMax)}.` : "",
    "Draw the visual scene; do not turn picture directions into body text.",
    "If people appear: photorealistic humans, not cartoon/illustration unless the visual says otherwise.",
    "Leave safe margins away from top profile strip and bottom reply bar.",
  ].filter(Boolean).join("\n");

  for (const [visualMax, conceptMax] of [[900, 600], [500, 350], [320, 220]] as const) {
    const text = assemble(visualMax, conceptMax);
    if (text.length <= limitChars) return text;
  }
  return assemble(220, 150).slice(0, limitChars);
}