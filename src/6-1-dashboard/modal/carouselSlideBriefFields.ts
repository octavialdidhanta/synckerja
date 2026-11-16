import { parseMarkdownTable } from "../utils/markdownTableUtils";
import { toCarouselStoryboardTable } from "./briefStoryboardConstants";

export type CarouselSlideBriefFields = {
  timing: string;
  sceneVisual: string;
  teks: string;
  elementLainnya: string;
};

/**
 * Read Scene Visual / Teks / Element Lainnya for carousel slide N (1-based)
 * from the plan brief markdown storyboard table.
 */
export function carouselSlideBriefFields(
  briefMarkdown: string | null | undefined,
  slideNumber: number,
): CarouselSlideBriefFields | null {
  if (!briefMarkdown?.trim()) return null;
  if (!Number.isInteger(slideNumber) || slideNumber < 1) return null;

  const parsed = parseMarkdownTable(briefMarkdown);
  if (!parsed?.table?.length) return null;

  const normalized = toCarouselStoryboardTable(parsed.table);
  const body = normalized.slice(1);
  if (body.length === 0) return null;

  const byTiming = body.findIndex((row) => {
    const timing = String(row[0] ?? "").trim();
    if (new RegExp(`^slide\\s*${slideNumber}\\b`, "i").test(timing)) return true;
    if (new RegExp(`^${slideNumber}\\s*$`).test(timing)) return true;
    return false;
  });
  const row = byTiming >= 0 ? body[byTiming] : body[slideNumber - 1];
  if (!row) return null;

  // Canonical carousel columns: Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging
  return {
    timing: String(row[0] ?? "").trim(),
    sceneVisual: String(row[2] ?? "").trim(),
    teks: String(row[3] ?? "").trim(),
    elementLainnya: String(row[4] ?? "").trim(),
  };
}
