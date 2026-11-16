import { slideTexts, type CarouselSlide } from "./canvaCarouselBrief.ts";

const MIN_HEADLINE_SCORE = 0.55;
const MIN_TOKEN_LEN = 2;

/** Last-page brand strings as sent to Canva via buildCanvaCarouselBrief. */
export type PageOrderLockup = {
  brandName?: string | null;
  tagline?: string | null;
  facts?: string[] | null;
};

/** Needles used to match a brief slide to a Canva page (lockup overrides last slide). */
export function pageOrderNeedles(
  slide: CarouselSlide,
  index: number,
  total: number,
  lockup?: PageOrderLockup | null,
): string[] {
  const last = index === total - 1;
  if (last && lockup) {
    const locked = [
      lockup.brandName,
      lockup.tagline,
      ...(Array.isArray(lockup.facts) ? lockup.facts : []),
    ]
      .map((part) => String(part ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (locked.length > 0) return locked;
  }
  const { headline, small } = slideTexts(slide);
  return [headline, small, slide.copy]
    .map((part) => String(part ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function normalizeCarouselText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeCarouselText(value).split(" ").filter((token) => token.length >= MIN_TOKEN_LEN);
}

/** 0..1 score: how well `needle` appears in `haystack`. */
export function carouselTextScore(needle: string, haystack: string): number {
  const n = normalizeCarouselText(needle);
  const h = normalizeCarouselText(haystack);
  if (!n || !h) return 0;
  if (h.includes(n)) return 1;
  if (n.length >= 8 && n.includes(h)) return 0.9;
  // Canva sometimes joins words in richtext dumps ("PrediksiDampak FinansialLebih").
  const nCompact = n.replace(/\s+/g, "");
  const hCompact = h.replace(/\s+/g, "");
  if (nCompact.length >= 8 && hCompact.includes(nCompact)) return 0.95;
  if (nCompact.length >= 12 && nCompact.includes(hCompact) && hCompact.length >= 8) return 0.85;
  const needleTokens = tokens(needle);
  if (needleTokens.length === 0) return 0;
  const hayTokens = new Set(tokens(haystack));
  let hit = 0;
  for (const token of needleTokens) {
    if (hayTokens.has(token)) hit += 1;
  }
  return hit / needleTokens.length;
}

function pageBlob(texts: string[]): string {
  return texts.join(" ");
}

function isBlankPageTexts(texts: string[]): boolean {
  const blob = normalizeCarouselText(pageBlob(texts));
  return blob.length < 4;
}

export type CarouselPageOrderResult = {
  orderedPageNumbers: number[];
  droppedBlanks: number[];
  matched: Array<{ slide: number; page: number; score: number; headline: string }>;
};

/**
 * Map each brief slide to a unique Canva page by headline (then small copy).
 * Blank / unmatched pages are dropped. Returns null when a 1:1 match is impossible.
 */
export function orderCarouselPages(
  slides: CarouselSlide[],
  pageTexts: Map<number, string[]>,
  lockup?: PageOrderLockup | null,
): CarouselPageOrderResult | null {
  if (slides.length < 2) return null;

  const candidates: Array<{ page: number; texts: string[]; blob: string }> = [];
  const droppedBlanks: number[] = [];
  for (const [page, texts] of [...pageTexts.entries()].sort((a, b) => a[0] - b[0])) {
    if (!Number.isInteger(page) || page < 1) continue;
    if (isBlankPageTexts(texts)) {
      droppedBlanks.push(page);
      continue;
    }
    candidates.push({ page, texts, blob: pageBlob(texts) });
  }
  if (candidates.length < slides.length) return null;

  const used = new Set<number>();
  const matched: CarouselPageOrderResult["matched"] = [];
  const orderedPageNumbers: number[] = [];

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const needles = pageOrderNeedles(slide, index, slides.length, lockup);
    if (needles.length === 0) return null;

    let best: { page: number; score: number } | null = null;
    for (const candidate of candidates) {
      if (used.has(candidate.page)) continue;
      let score = 0;
      for (const needle of needles) {
        score = Math.max(score, carouselTextScore(needle, candidate.blob));
      }
      if (!best || score > best.score || (score === best.score && candidate.page < best.page)) {
        best = { page: candidate.page, score };
      }
    }
    if (!best || best.score < MIN_HEADLINE_SCORE) return null;
    used.add(best.page);
    orderedPageNumbers.push(best.page);
    matched.push({
      slide: index + 1,
      page: best.page,
      score: Number(best.score.toFixed(3)),
      headline: needles[0] ?? "",
    });
  }

  if (orderedPageNumbers.length !== slides.length) return null;
  if (new Set(orderedPageNumbers).size !== slides.length) return null;
  return { orderedPageNumbers, droppedBlanks, matched };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pageNumberOf(record: Record<string, unknown>): number | null {
  const numbered = Number(record.page_number ?? record.page);
  if (Number.isInteger(numbered) && numbered >= 1 && numbered <= 10) return numbered;
  const index = Number(record.page_index);
  if (Number.isInteger(index) && index >= 1 && index <= 10) return index;
  if (index === 0) return 1;
  return null;
}

function elementPlainText(record: Record<string, unknown>): string {
  if (typeof record.text === "string" && record.text.trim()) return record.text.trim();
  if (typeof record.plain_text === "string" && record.plain_text.trim()) return record.plain_text.trim();
  if (Array.isArray(record.textRegions)) {
    return record.textRegions.map((region) => {
      const item = asRecord(region);
      return typeof item?.characters === "string" ? item.characters : "";
    }).join("").trim();
  }
  if (!Array.isArray(record.regions)) return "";
  return record.regions.map((region) => {
    const item = asRecord(region);
    return typeof item?.text === "string" ? item.text : "";
  }).join("").trim();
}

function pushText(byPage: Map<number, string[]>, page: number, text: string): void {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length < 2) return;
  const list = byPage.get(page) ?? [];
  if (!list.includes(cleaned)) list.push(cleaned);
  byPage.set(page, list);
}

function walkDesignTexts(value: unknown, inheritedPage: number | null, byPage: Map<number, string[]>): void {
  if (Array.isArray(value)) {
    for (const item of value) walkDesignTexts(item, inheritedPage, byPage);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const page = pageNumberOf(record) ?? inheritedPage;
  const text = elementPlainText(record);
  if (page && text) pushText(byPage, page, text);
  for (const child of Object.values(record)) walkDesignTexts(child, page, byPage);
}

/**
 * Build page → text snippets from a Canva read-design / edit payload.
 * Prefers design_content page order (1-based index) when present.
 */
export function collectPageTextsFromDesign(payload: unknown): Map<number, string[]> {
  const byPage = new Map<number, string[]>();
  const root = asRecord(payload);
  if (!root) return byPage;

  const content = asRecord(root.design_content);
  const nestedPages = Array.isArray(content?.pages) ? content.pages : null;
  const topPages = Array.isArray(root.design_content) ? root.design_content : null;
  const pages = nestedPages ?? topPages;
  if (Array.isArray(pages) && pages.length > 0) {
    for (const [index, item] of pages.entries()) {
      const page = asRecord(item);
      if (!page) continue;
      const number = pageNumberOf(page) ?? index + 1;
      walkDesignTexts(page.elements ?? page, number, byPage);
    }
  }
  walkDesignTexts(root, null, byPage);
  return byPage;
}

function richtextPlain(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.plaintext === "string" && record.plaintext.trim()) return record.plaintext.trim();
  if (typeof record.plain_text === "string" && record.plain_text.trim()) return record.plain_text.trim();
  if (typeof record.text === "string" && record.text.trim()) return record.text.trim();
  if (Array.isArray(record.regions)) {
    return record.regions.map((region) => {
      const item = asRecord(region);
      return typeof item?.text === "string" ? item.text : "";
    }).join("").trim();
  }
  return "";
}

/**
 * Build page → text snippets from get-design-content (richtexts) payloads.
 * Index is 1-based when Canva omits page_number.
 */
export function collectPageTextsFromGetDesignContent(payload: unknown): Map<number, string[]> {
  const byPage = new Map<number, string[]>();
  const root = asRecord(payload);
  if (!root) return byPage;

  const pageRows = Array.isArray(root.pages)
    ? root.pages
    : Array.isArray(root.contents)
      ? root.contents
      : Array.isArray(asRecord(root.result)?.pages)
        ? (asRecord(root.result)!.pages as unknown[])
        : null;

  if (Array.isArray(pageRows) && pageRows.length > 0) {
    for (const [index, item] of pageRows.entries()) {
      const page = asRecord(item);
      if (!page) {
        if (typeof item === "string" && item.trim()) pushText(byPage, index + 1, item);
        continue;
      }
      const number = pageNumberOf(page) ?? index + 1;
      const rich = Array.isArray(page.richtexts)
        ? page.richtexts
        : Array.isArray(page.rich_texts)
          ? page.rich_texts
          : Array.isArray(page.texts)
            ? page.texts
            : null;
      if (rich) {
        for (const entry of rich) {
          const text = richtextPlain(entry);
          if (text) pushText(byPage, number, text);
        }
      }
      const direct = richtextPlain(page.content ?? page.text ?? page.plaintext ?? page.plain_text ?? "");
      if (direct) pushText(byPage, number, direct);
      walkDesignTexts(page, number, byPage);
    }
  }

  // Some MCP wrappers nest richtexts at the top level without page wrappers.
  if (byPage.size === 0 && Array.isArray(root.richtexts)) {
    for (const entry of root.richtexts) {
      const text = richtextPlain(entry);
      if (text) pushText(byPage, 1, text);
    }
  }

  if (byPage.size === 0) walkDesignTexts(root, null, byPage);
  return byPage;
}

function mcpContentPlainTexts(payload: unknown): string[] {
  const root = asRecord(payload);
  if (!root) return [];
  const content = Array.isArray(root.content) ? root.content : null;
  if (!content) return [];
  const parts: string[] = [];
  for (const item of content) {
    const text = asRecord(item)?.text;
    if (typeof text === "string" && text.trim()) parts.push(text.trim());
  }
  return parts;
}

/**
 * When MCP returns one flat text blob (no page wrappers), split on badges like "2/8".
 * Returns empty map if fewer than 2 page sections are found.
 */
export function collectPageTextsFromFlatBadgeDump(text: string): Map<number, string[]> {
  const byPage = new Map<number, string[]>();
  const source = String(text ?? "");
  if (!source.trim()) return byPage;
  // Canva MCP dumps page markers as "1/8", "3 / 8" (often alone on a line).
  const badge = /(?:^|\n)\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*(?=\n|$)/g;
  const marks: Array<{ page: number; total: number; index: number; len: number }> = [];
  for (const match of source.matchAll(badge)) {
    const page = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isInteger(page) || page < 1 || page > 10) continue;
    if (!Number.isInteger(total) || total < 2 || total > 10) continue;
    marks.push({ page, total, index: match.index ?? 0, len: match[0].length });
  }
  if (marks.length < 2) return byPage;
  const expectedTotal = marks[0].total;
  // Section for page N is text AFTER previous badge up to (and excluding) badge N,
  // or: text between badge N and badge N+1. Canva often places the badge near the
  // end of the page, so prefer "text before badge N belongs to page N".
  for (let i = 0; i < marks.length; i += 1) {
    const start = i === 0 ? 0 : marks[i - 1].index + marks[i - 1].len;
    const end = marks[i].index;
    const chunk = source.slice(start, end).replace(/\s+/g, " ").trim();
    if (chunk) pushText(byPage, marks[i].page, chunk);
  }
  // Trailing text after the last badge (rare) stays on that page.
  const last = marks[marks.length - 1];
  const tail = source.slice(last.index + last.len).replace(/\s+/g, " ").trim();
  if (tail) pushText(byPage, last.page, tail);
  // Incomplete badge sets are unsafe for ordering — caller should prefer per-page reads.
  if (byPage.size < expectedTotal) return byPage;
  return byPage;
}

/** Prefer get-design-content shape, then read-design / design_content / flat MCP text. */
export function collectPageTextsFromAny(payload: unknown): Map<number, string[]> {
  const fromContent = collectPageTextsFromGetDesignContent(payload);
  if (fromContent.size > 0) return fromContent;
  const fromDesign = collectPageTextsFromDesign(payload);
  if (fromDesign.size > 0) return fromDesign;
  const plains = mcpContentPlainTexts(payload);
  if (plains.length > 0) {
    const fromFlat = collectPageTextsFromFlatBadgeDump(plains.join("\n"));
    if (fromFlat.size > 0) return fromFlat;
    // Single-page probe: stash whole text on page 1 for callers that reassign.
    const single = new Map<number, string[]>();
    pushText(single, 1, plains.join("\n"));
    return single;
  }
  return new Map();
}

/** Near-white RGBA bitmap = blank cover page Canva sometimes inserts. */
export function isNearBlankRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  sampleStep = 24,
): boolean {
  if (width < 2 || height < 2 || pixels.byteLength < width * height * 3) return false;
  const step = Math.max(8, sampleStep);
  let checked = 0;
  let bright = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      checked += 1;
      if (r >= 245 && g >= 245 && b >= 245) bright += 1;
    }
  }
  return checked > 0 && bright / checked >= 0.98;
}
