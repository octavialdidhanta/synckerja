import { briefFacts, textHasFact } from "./briefFacts.mjs";

export type CarouselSlide = {
  label: string;
  scene: string;
  copy: string;
  elements: string;
  tagging: string;
};

function cells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split("|").map((cell) => cell.replace(/\s+/g, " ").trim());
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function columnIndex(headers: string[], match: (header: string) => boolean): number {
  return headers.findIndex(match);
}

function cellText(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim().slice(0, 500);
}

/**
 * Creative text from the storyboard. The image column stays empty.
 * Scene Visual is the picture. Teks is the on-slide copy. Older boards
 * stored that copy under VO. Element Lainnya carries the hook and the
 * other pieces that sit with that copy.
 */
export function carouselSlidesFromBrief(markdown: string): CarouselSlide[] {
  const lines = String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("synckerja-brief"));
  if (lines.length < 2) return [];

  const headers = cells(lines[0]).map(headerKey);
  const sceneIndex = columnIndex(headers, (header) => header.includes("scene"));
  const visualIndex = columnIndex(headers, (header) => header === "visual");
  const textIndex = sceneIndex >= 0 ? sceneIndex : visualIndex;
  const teksIndex = columnIndex(headers, (header) => header === "teks" || header.startsWith("teks ") || header === "copy" || header === "copywriting");
  const voiceIndex = columnIndex(headers, (header) => header === "vo" || header.startsWith("vo ") || header.includes("voice over"));
  const copyIndex = teksIndex >= 0 ? teksIndex : voiceIndex;
  const elementIndex = columnIndex(headers, (header) => header.includes("element"));
  const taggingIndex = columnIndex(headers, (header) => header.includes("tag"));
  const timingIndex = columnIndex(headers, (header) => header === "timing" || header === "no" || header === "#");
  if (textIndex < 0) return [];

  const slides: CarouselSlide[] = [];
  for (const line of lines.slice(1)) {
    if (/^\|\s*:?-{3,}/.test(line)) continue;
    const row = cells(line);
    const timing = timingIndex >= 0 ? row[timingIndex] ?? "" : "";
    if (timing && !/^slide\s+\d+\b/i.test(timing)) continue;
    const scene = cellText(row, textIndex);
    if (!scene) continue;
    const number = slides.length + 1;
    const label = /^slide\s+\d+\b/i.test(timing) ? timing : `Slide ${number}`;
    slides.push({
      label,
      scene,
      copy: cellText(row, copyIndex),
      elements: cellText(row, elementIndex),
      tagging: cellText(row, taggingIndex),
    });
    if (slides.length >= 10) break;
  }
  return slides;
}

/** One shared reference slot, or null when the board does not agree. */
export function carouselReferencePosition(slides: CarouselSlide[]): number | null {
  if (slides.length === 0) return null;
  let chosen = 0;
  for (const slide of slides) {
    const matches = [...slide.elements.matchAll(/referensi\s+([1-5])\b/gi)];
    if (matches.length !== 1) return null;
    const position = Number(matches[0][1]);
    if (chosen === 0) chosen = position;
    else if (chosen !== position) return null;
  }
  return chosen > 0 ? chosen : null;
}

const COLOR_SENTENCE = /\b(colou?rs?|palette|palet|warna|hex|red|blue|green|yellow|orange|purple|pink|black|white|gr[ae]y|brown|gold|navy|teal|beige|cream|maroon|cyan|magenta|merah|biru|hijau|kuning|ungu|hitam|putih|abu|emas|coklat)\b|#[0-9a-fA-F]{3,8}/i;
const LOGO_SENTENCE = /\blogos?\b|wordmark|brand mark/i;

/** Drop any sentence that names a color. Layout reference is not a palette. */
export function layoutOnlyDescription(text: string): string {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0 && !COLOR_SENTENCE.test(part) && !LOGO_SENTENCE.test(part))
    .join(" ")
    .slice(0, 900);
}

function referenceNotes(styleLock: string): Map<number, string> {
  const cleaned = layoutOnlyDescription(styleLock);
  const notes = new Map<number, string>();
  const marks = [...cleaned.matchAll(/Referensi\s+([1-5])\s*:\s*/gi)];
  if (marks.length === 0) {
    if (cleaned) notes.set(0, cleaned.slice(0, 280));
    return notes;
  }
  for (let index = 0; index < marks.length; index += 1) {
    const start = (marks[index].index ?? 0) + marks[index][0].length;
    const end = marks[index + 1]?.index ?? cleaned.length;
    const note = cleaned.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 280);
    if (note) notes.set(Number(marks[index][1]), note);
  }
  return notes;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export type CatalogPalette = {
  primary: string;
  secondary: string;
  accent: string;
};

/** Colors written outside the storyboard table. Missing line means no palette. */
export function carouselPalette(markdown: string): CatalogPalette | null {
  const match = /Warna:\s*primer\s+(#[0-9a-fA-F]{6})\s*,\s*sekunder\s+(#[0-9a-fA-F]{6})\s*,\s*aksen\s+(#[0-9a-fA-F]{6})/i.exec(String(markdown ?? ""));
  if (!match) return null;
  return {
    primary: match[1].toLowerCase(),
    secondary: match[2].toLowerCase(),
    accent: match[3].toLowerCase(),
  };
}

const ELEMENT_MARK = /(Hook headline|Headline|Point|Ajakan|Tips|Pesan Utama|Pesan|Teks)\s*:\s*|(Visual hook|Dialog bubble|Arah gambar|Ilustrasi|Gambar)\b\s*:?\s*|Referensi\s+[1-5]\b/gi;
const PICTURE_LABEL = new Set(["visual hook", "ilustrasi", "gambar", "dialog bubble", "arah gambar"]);
const PICTURE_LEAD = /^(ilustrasi|gambar|visual hook|dialog bubble|arah gambar)\b[:\s,-]*/i;

function elementPieces(elements: string): { copy: string[]; picture: string[] } {
  const source = elements.replace(/\s+/g, " ").trim();
  if (!source) return { copy: [], picture: [] };
  const marks: Array<{ index: number; end: number; label: string | null }> = [];
  for (const match of source.matchAll(ELEMENT_MARK)) {
    marks.push({
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      label: (match[1] || match[2]) ? (match[1] || match[2]).toLowerCase() : null,
    });
  }
  const copy: string[] = [];
  const picture: string[] = [];
  const push = (kind: "copy" | "picture", value: string) => {
    let text = value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
    if (!text) return;
    if (kind === "copy" && PICTURE_LEAD.test(text)) {
      text = text.replace(PICTURE_LEAD, "").trim().replace(/[.\s]+$/, "");
      if (!text) return;
      picture.push(text);
      return;
    }
    (kind === "picture" ? picture : copy).push(text);
  };
  if (marks.length === 0) {
    push("copy", source);
    return { copy, picture };
  }
  if (marks[0].index > 0) push("copy", source.slice(0, marks[0].index));
  for (let index = 0; index < marks.length; index += 1) {
    const mark = marks[index];
    if (!mark.label) continue;
    const next = marks[index + 1]?.index ?? source.length;
    push(PICTURE_LABEL.has(mark.label) ? "picture" : "copy", source.slice(mark.end, next));
  }
  return { copy, picture };
}

function referenceSlot(elements: string): number | null {
  const matches = [...String(elements ?? "").matchAll(/referensi\s+([1-5])\b/gi)];
  if (matches.length !== 1) return null;
  return Number(matches[0][1]);
}

function paletteLine(palette?: CatalogPalette | null): string {
  const primary = HEX.test(palette?.primary ?? "") ? palette!.primary.toLowerCase() : "";
  const secondary = HEX.test(palette?.secondary ?? "") ? palette!.secondary.toLowerCase() : "";
  const accent = HEX.test(palette?.accent ?? "") ? palette!.accent.toLowerCase() : "";
  if (!primary || !secondary || !accent) {
    return "Choose readable colors. Do not copy colors from another design.";
  }
  return `Colors: primary ${primary}, secondary ${secondary}, accent ${accent}. Keep the words readable.`;
}

function logoLine(logo?: "required" | "none"): string {
  if (logo === "required") return "Leave the top center of every page empty.";
  return "";
}

const PERSON_SCENE = /(orang|manusia|pria|wanita|perempuan|laki-laki|ibu|ayah|bapak|anak|chef|koki|pelanggan|pelayan|penjual|pembeli|pegawai|karyawan|kasir|barista|bayi|nenek|kakek|suami|istri|remaja|bocah|gadis|pemuda|pemudi|tamu|keluarga|\bperson\b|\bpeople\b|\bman\b|\bwoman\b|\bchild\b|\bboy\b|\bgirl\b)/i;

const FOOD_SCENE = /\b(?:sate|satay|kambing|daging|sop|soto|gulai|iga|nasi|ayam|bebek|ikan|udang|makanan|hidangan|masakan|menu|piring|mangkuk|tusuk|tusukan|bumbu|sambal|kuah|lontong|ketupat|panggang|bakar|goreng|food|dish|meal|plate|skewers?)\b/i;

/** Written once for the carousel; pages that show people point to it. */
export const PERSON_PHOTO_RULE =
  "Person photo rule: photograph real humans with natural skin and a real camera. Not an illustration, cartoon, 3D render, or synthetic face.";

/** Written once for the carousel; pages that show food point to it. */
export const FOOD_PHOTO_RULE =
  "Food photo rule: real food shot on a real camera in a real Indonesian warung, natural or warm light, true colors, charred grill edges, uneven grill marks, sauce that is not plastic-glossy, small imperfections, shallow depth of field. Not CGI, 3D, illustration, oversaturated, or too perfect.";

function pictureInstruction(picture: string): string {
  const marks: string[] = [];
  if (PERSON_SCENE.test(picture)) marks.push("Real person photo.");
  if (FOOD_SCENE.test(picture)) marks.push("Real food photo.");
  if (marks.length === 0) return `Draw: ${picture}`;
  return `${marks.join(" ")} Scene: ${picture}`;
}

const BRIEF_LIMIT = 3500;

function clipScene(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return (space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:\s]+$/, "");
}

function menuLine(names?: string[]): string {
  const list = (names ?? [])
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (list.length === 0) return "";
  return `Real menu shown: ${list.join("; ")}. Draw these exact dishes.`;
}

function productPhotoLine(names?: string[]): string {
  const main = (names ?? []).map((name) => name.replace(/\s+/g, " ").trim()).find(Boolean);
  if (!main) return "";
  return `A real photo of ${main} goes in the center of the last page only. Keep that center empty. Photograph the food yourself on the other pages.`;
}

export function buildCanvaCarouselBrief(input: {
  title: string;
  caption: string;
  slides: CarouselSlide[];
  styleLock?: string;
  palette?: CatalogPalette | null;
  logo?: "required" | "none";
  productPhotos?: string[];
  requiredNote?: string;
  forbiddenNote?: string;
}): string {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 200) || "Carousel";
  const caption = input.caption.replace(/\s+/g, " ").trim().slice(0, 280);
  const requiredFacts = briefFacts(input.requiredNote).slice(0, 5);
  const forbiddenNote = (input.forbiddenNote ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const notes = referenceNotes(input.styleLock ?? "");
  const sharedNote = notes.get(0) ?? "";
  const captionLine = caption ? ` Caption: ${caption}` : "";
  let showsFood = false;
  let showsPerson = false;
  const buildPages = (sceneLimit: number) => input.slides
    .map((slide, index) => {
      const pieces = elementPieces(slide.elements);
      const slot = referenceSlot(slide.elements);
      const note = (slot ? notes.get(slot) : "") || sharedNote;
      const words = [slide.copy, ...pieces.copy].map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
      if (index === input.slides.length - 1) {
        for (const fact of requiredFacts) {
          if (!words.some((word) => textHasFact(word, fact))) words.push(fact);
        }
      }
      const picture = [slide.scene, ...pieces.picture].map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
      const scene = clipScene(picture.join(". "), sceneLimit);
      if (FOOD_SCENE.test(scene)) showsFood = true;
      if (PERSON_SCENE.test(scene)) showsPerson = true;
      const lines = [`Page ${index + 1}`];
      if (note) lines.push(`Layout and type: ${note}`);
      const photoPage = index === input.slides.length - 1 && (input.productPhotos ?? []).length > 0;
      if (photoPage) {
        // The real photo is this page's food: draw only the setting around it.
        if (scene) lines.push(`Setting only, no food drawn: ${scene}`);
        lines.push("Keep the center empty for the real product photo.");
      } else if (scene) {
        lines.push(pictureInstruction(scene));
      }
      if (words.length > 0) lines.push(`Write only: ${words.join(" | ")}`);
      if (slide.tagging) lines.push(`Small label: ${slide.tagging}`);
      return lines.join("\n");
    })
    .join("\n");
  const assemble = (pages: string) => [
    `Design an Instagram carousel with ${input.slides.length} portrait 4:5 pages. One page per slide. Make every page editable.`,
    requiredFacts.length > 0 ? `Write exactly this on the last page: ${requiredFacts.join(" ")}` : "",
    forbiddenNote ? `Do not write any of this: ${forbiddenNote}` : "",
    paletteLine(input.palette),
    logoLine(input.logo),
    showsPerson ? PERSON_PHOTO_RULE : "",
    showsFood || (input.productPhotos ?? []).length > 0 ? FOOD_PHOTO_RULE : "",
    menuLine(input.productPhotos),
    productPhotoLine(input.productPhotos),
    `Title: ${title}.${captionLine}`,
    pages,
    "Write only the listed words. Draw the picture, and do not turn the picture instructions into text. Use the layout and the named typeface for that page.",
  ].filter(Boolean).join("\n");
  // Shorten scenes before anything is cut, so the last page (CTA, required facts) always fits.
  let brief = "";
  for (const limit of [400, 220, 150, 100, 60]) {
    showsFood = false;
    showsPerson = false;
    brief = assemble(buildPages(limit));
    if (brief.length <= BRIEF_LIMIT) break;
  }
  return brief.slice(0, BRIEF_LIMIT);
}
