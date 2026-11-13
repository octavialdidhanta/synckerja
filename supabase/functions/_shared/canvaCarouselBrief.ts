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

const COLOR_WORD = /\b(colou?rs?|colou?red|palette|palet|warna|hex|reddish|red|blue|green|yellow|orange|purple|pink|black|white|gr[ae]y|brown|golden|gold|navy|teal|beige|cream|maroon|cyan|magenta|merah|biru|hijau|kuning|ungu|hitam|putih|abu-abu|abu|emas|coklat)\b|#[0-9a-fA-F]{3,8}\b/gi;
const LOGO_SENTENCE = /\blogos?\b|wordmark|brand mark/i;
const LAYOUT_ZONE = /\b(PHOTO|HEADLINE|TEXT|DECOR|TYPE)\s*:\s*/g;

/**
 * Layout reference text without colors or logos. Color words are taken out of the
 * sentence instead of dropping it, so a long description keeps its positions and sizes.
 */
export function layoutOnlyDescription(text: string): string {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0 && !LOGO_SENTENCE.test(part))
    .map((part) => part
      .replace(COLOR_WORD, "")
      .replace(/[*_`]+/g, "")
      .replace(/^[-•\s]+/, "")
      .replace(/\(\s*\)/g, "")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/([,;])\s*([,;.])/g, "$2")
      .replace(/([,;])\s*(and|or)\s+/gi, "$1 ")
      .replace(/\s+(and|or)\s*([,.;])/gi, "$2")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/^\p{Ll}/u, (letter) => letter.toUpperCase()))
    .filter((part) => part.replace(/^(PHOTO|HEADLINE|TEXT|DECOR|TYPE)\s*:\s*/i, "").split(/\s+/).filter((word) => /\p{L}/u.test(word)).length >= 2)
    .join(" ")
    .slice(0, 8000);
}

/**
 * Fit a layout note into the room left in the brief. Decorations go first, then the
 * small text blocks; photo, headline and typeface are kept longest.
 */
export function fitLayoutNote(note: string, room: number): string {
  const text = note.replace(/\s+/g, " ").trim();
  if (room <= 0) return "";
  if (text.length <= room) return text;
  const marks = [...text.matchAll(LAYOUT_ZONE)];
  let kept = text;
  if (marks.length > 0) {
    const zones = marks.map((mark, index) => ({
      label: mark[1].toUpperCase(),
      body: text.slice((mark.index ?? 0) + mark[0].length, marks[index + 1]?.index ?? text.length).trim(),
    }));
    const lead = text.slice(0, marks[0].index ?? 0).trim();
    const join = (list: typeof zones) => [lead, ...list.map((zone) => `${zone.label}: ${zone.body}`)].filter(Boolean).join(" ");
    let list = zones;
    for (const drop of ["DECOR", "TEXT"]) {
      if (join(list).length <= room) break;
      list = list.filter((zone) => zone.label !== drop);
    }
    kept = join(list);
  }
  if (kept.length <= room) return kept;
  const cut = kept.slice(0, room);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (stop > room * 0.6 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : room)).trim();
}

function referenceNotes(styleLock: string): Map<number, string> {
  const cleaned = layoutOnlyDescription(styleLock);
  const notes = new Map<number, string>();
  const marks = [...cleaned.matchAll(/Referensi\s+([1-5])\s*:\s*/gi)];
  if (marks.length === 0) {
    if (cleaned) notes.set(0, cleaned);
    return notes;
  }
  for (let index = 0; index < marks.length; index += 1) {
    const start = (marks[index].index ?? 0) + marks[index][0].length;
    const end = marks[index + 1]?.index ?? cleaned.length;
    const note = cleaned.slice(start, end).replace(/\s+/g, " ").trim();
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

/** Drawing directions an older storyboard wrote as copy: they belong to the picture. */
const DIRECTION_LEAD = /^(infografis|infographic|panah|arrow|ikon|icon|diagram|grafik|chart|tanda panah|lingkaran|garis penunjuk)\b/i;

type CopyPiece = { label: string; text: string };

const ABBREVIATION = /\b(vs|dll|dsb|dkk|tgl|no|hlm|min|maks|kg|gr|rp)\./gi;

/** Sentences of a short text; "vs." and similar abbreviations do not end a sentence. */
function sentencesOf(text: string): string[] {
  const guarded = text.replace(ABBREVIATION, (match) => match.slice(0, -1) + "\u0000");
  return guarded
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\u0000/g, ".").trim())
    .filter(Boolean);
}

function elementPieces(elements: string): { copy: string[]; labeled: CopyPiece[]; picture: string[] } {
  const source = elements.replace(/\s+/g, " ").trim();
  const labeled: CopyPiece[] = [];
  const picture: string[] = [];
  if (!source) return { copy: [], labeled, picture };
  const marks: Array<{ index: number; end: number; label: string | null }> = [];
  for (const match of source.matchAll(ELEMENT_MARK)) {
    marks.push({
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      label: (match[1] || match[2]) ? (match[1] || match[2]).toLowerCase() : null,
    });
  }
  const tidy = (value: string) => value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  const push = (kind: "copy" | "picture", label: string, value: string) => {
    let text = tidy(value);
    if (!text) return;
    if (kind === "picture") {
      picture.push(text);
      return;
    }
    if (PICTURE_LEAD.test(text)) {
      text = tidy(text.replace(PICTURE_LEAD, ""));
      if (text) picture.push(text);
      return;
    }
    // "Serat halus. Panah menunjuk ke serat" keeps the label and draws the arrow.
    const kept: string[] = [];
    for (const sentence of sentencesOf(text)) {
      if (DIRECTION_LEAD.test(sentence)) picture.push(tidy(sentence));
      else kept.push(sentence);
    }
    if (kept.length > 0) labeled.push({ label, text: tidy(kept.join(" ")) });
  };
  if (marks.length === 0) {
    push("copy", "", source);
  } else {
    if (marks[0].index > 0) push("copy", "", source.slice(0, marks[0].index));
    for (let index = 0; index < marks.length; index += 1) {
      const mark = marks[index];
      if (!mark.label) continue;
      const next = marks[index + 1]?.index ?? source.length;
      push(PICTURE_LABEL.has(mark.label) ? "picture" : "copy", mark.label, source.slice(mark.end, next));
    }
  }
  return { copy: labeled.map((piece) => piece.text), labeled, picture };
}

const SMALL_TEXT_WORDS = 12;

/** The slide's spoken line as on-slide small text: one sentence, about 12 words at most. */
export function shortSlideText(text: string, maxWords = SMALL_TEXT_WORDS): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = sentencesOf(clean);
  const fitting = sentences.find((sentence) => sentence.split(" ").length <= maxWords + 2);
  if (fitting) return fitting.trim();
  const words = sentences[0].split(" ");
  const head = words.slice(0, maxWords).join(" ");
  const comma = head.lastIndexOf(",");
  if (comma > 0 && head.slice(0, comma).split(" ").length >= Math.ceil(maxWords / 2)) return head.slice(0, comma).trim();
  return head.replace(/[,;:\s]+$/, "").trim();
}

/** Headline, small text and small labels of one slide, in that order of size. */
export function slideTexts(slide: CarouselSlide): { headline: string; small: string; labels: string[] } {
  const pieces = elementPieces(slide.elements);
  const headlinePiece = pieces.labeled.find((piece) => piece.label === "hook headline" || piece.label === "headline")
    ?? pieces.labeled[0];
  const small = shortSlideText(slide.copy);
  const labels = pieces.labeled.filter((piece) => piece !== headlinePiece).map((piece) => piece.text);
  if (headlinePiece) return { headline: headlinePiece.text, small, labels };
  return { headline: small, small: "", labels };
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

const MEAT_SCENE = /\b(?:daging|kambing|sapi|domba|iga|meat|goat|mutton|lamb|beef)\b/i;
const GOAT_SCENE = /\b(?:kambing|goat|mutton|domba|lamb)\b/i;
const SKEWER_SCENE = /\b(?:sate|satay|skewers?)\b/i;

/**
 * Only for content that shows meat or skewers: the image model drew goat meat like pork.
 * Empty for every other business, so it never reaches a charity or a non-food catalog.
 */
export function meatRule(text: string): string {
  const source = String(text ?? "");
  const meat = MEAT_SCENE.test(source);
  const skewer = SKEWER_SCENE.test(source);
  if (!meat && !skewer) return "";
  const parts = ["Meat rule: draw the exact animal named in the scene. The meat must never look like pork."];
  if (GOAT_SCENE.test(source)) {
    parts.push("Goat meat (kambing) is deep red with a fine grain and only thin white fat, cut into small pieces. No thick skin, no fat rind, never pale pink.");
  }
  if (skewer) parts.push("Sate is cubed chunks of meat threaded on bamboo skewers, never minced, meatball or sausage shaped.");
  return parts.join(" ");
}

/** Photo rules that fit a picture description, for prompts outside the carousel brief. */
export function photoRules(text: string): string {
  const source = String(text ?? "");
  return [
    PERSON_SCENE.test(source) ? PERSON_PHOTO_RULE : "",
    FOOD_SCENE.test(source) ? FOOD_PHOTO_RULE : "",
    meatRule(source),
  ].filter(Boolean).join(" ");
}

function pictureInstruction(picture: string): string {
  const marks: string[] = [];
  if (PERSON_SCENE.test(picture)) marks.push("Real person photo.");
  if (FOOD_SCENE.test(picture)) marks.push("Real food photo.");
  if (marks.length === 0) return `Draw: ${picture}`;
  return `${marks.join(" ")} Scene: ${picture}`;
}

/** First try: room for full scenes and a detailed layout. */
export const BRIEF_LIMIT_FULL = 5000;
/** Retry size when Canva does not accept the full brief. */
export const BRIEF_LIMIT_SHORT = 3500;
/** Room the shared layout keeps before scenes are shortened below SCENE_FLOOR. */
const LAYOUT_MIN_ROOM = 900;
/** Scenes are not shortened below this while the layout can still give up room. */
const SCENE_FLOOR = 220;
const LAYOUT_LEAD = "Layout and type for every page, copied from the reference: ";
const LAYOUT_TAIL = " Take only this structure from the reference and fit it to each page's content.";
const HIERARCHY_RULE =
  "On every page the headline is the biggest text. The small text sits near it and is clearly smaller. Never make the small text bigger than the headline.";
const CONSISTENCY_RULE = "Use the same frame, grid, and fonts on every page so the pages read as one set.";

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

/** A required fact (phone, price, link) taken out of a text, so it shows only in the contact box. */
function withoutFact(text: string, fact: string): string {
  const source = String(text ?? "");
  const digits = fact.replace(/\D/g, "");
  let result = source;
  if (digits.length >= 10 && digits.length === fact.length) {
    const pattern = new RegExp(`(?:\\+?62|0)?[\\s.-]*${digits.replace(/^(?:62|0)/, "").split("").join("[\\s.-]*")}`, "g");
    result = source.replace(pattern, " ");
  } else if (fact) {
    result = source.split(fact).join(" ");
  }
  return result.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/^[,.;:\s-]+|[,;:\s-]+$/g, "").trim();
}

export function buildCanvaCarouselBrief(input: {
  title: string;
  caption: string;
  slides: CarouselSlide[];
  styleLock?: string;
  palette?: CatalogPalette | null;
  logo?: "required" | "none";
  /** Menus the plan shows; Canva draws these dishes itself. */
  menus?: string[];
  /** A real photo placed on the last page. Not sent by canva-carousel-run any more. */
  productPhotos?: string[];
  requiredNote?: string;
  forbiddenNote?: string;
}, options: { limit?: number } = {}): string {
  const limitChars = options.limit && options.limit > 0 ? options.limit : BRIEF_LIMIT_FULL;
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 200) || "Carousel";
  const caption = input.caption.replace(/\s+/g, " ").trim().slice(0, 280);
  const requiredFacts = briefFacts(input.requiredNote).slice(0, 5);
  const forbiddenNote = (input.forbiddenNote ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const notes = referenceNotes(input.styleLock ?? "");
  const sharedNote = notes.get(0) ?? "";
  const captionLine = caption ? ` Caption: ${caption}` : "";
  // When every page uses the same reference, write its layout once instead of on each page.
  // A slot whose image is gone falls back to the reference that was described.
  const pageSlots = input.slides.map((slide) => referenceSlot(slide.elements));
  const sameSlot = pageSlots.every((slot) => slot === pageSlots[0]);
  const commonSlot = sameSlot ? pageSlots[0] : null;
  const commonNote = sameSlot
    ? (commonSlot ? notes.get(commonSlot) : "") || sharedNote || ([...notes.values()][0] ?? "")
    : sharedNote;
  const meatText = [title, ...input.slides.map((slide) => `${slide.scene} ${slide.elements}`), ...(input.menus ?? []), ...(input.productPhotos ?? [])].join(" ");
  const meat = meatRule(meatText);
  let showsFood = false;
  let showsPerson = false;
  const buildPages = (sceneLimit: number) => input.slides
    .map((slide, index) => {
      const pieces = elementPieces(slide.elements);
      const slot = referenceSlot(slide.elements);
      const note = (slot ? notes.get(slot) : "") || sharedNote;
      const last = index === input.slides.length - 1;
      const texts = slideTexts(slide);
      let { headline, small } = texts;
      let labels = [...texts.labels, slide.tagging].map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
      const contact: string[] = [];
      if (last) {
        for (const fact of requiredFacts) {
          headline = withoutFact(headline, fact);
          small = withoutFact(small, fact);
          labels = labels.map((label) => withoutFact(label, fact)).filter(Boolean);
          contact.push(fact);
        }
      }
      if (small && small.toLowerCase() === headline.toLowerCase()) small = "";
      const picture = [slide.scene, ...pieces.picture]
        .map((part) => part.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, ""))
        .filter(Boolean);
      const scene = clipScene(picture.join(". "), sceneLimit);
      if (FOOD_SCENE.test(scene)) showsFood = true;
      if (PERSON_SCENE.test(scene)) showsPerson = true;
      const lines = [`Page ${index + 1}`];
      if (note && !commonNote) lines.push(`Layout and type: ${fitLayoutNote(note, 350)}`);
      const photoPage = last && (input.productPhotos ?? []).length > 0;
      if (photoPage) {
        // The real photo is this page's food: draw only the setting around it.
        if (scene) lines.push(`Setting only, no food drawn: ${scene}`);
        lines.push("Keep the center empty for the real product photo.");
      } else if (scene) {
        lines.push(pictureInstruction(scene));
      }
      if (headline) lines.push(`Headline (biggest text): ${headline}`);
      if (small) lines.push(`Small text: ${small}`);
      if (labels.length > 0) lines.push(`Small labels: ${labels.join(" | ")}`);
      if (contact.length > 0) lines.push(`Contact box, separate at the bottom of this page: ${contact.join(" ")}`);
      return lines.join("\n");
    })
    .join("\n");
  const assemble = (pages: string, layout: string) => [
    `Design an Instagram carousel with ${input.slides.length} portrait 4:5 pages. One page per slide. Make every page editable.`,
    requiredFacts.length > 0 ? `Write exactly this on the last page, in its contact box: ${requiredFacts.join(" ")}` : "",
    forbiddenNote ? `Do not write any of this: ${forbiddenNote}` : "",
    paletteLine(input.palette),
    logoLine(input.logo),
    HIERARCHY_RULE,
    CONSISTENCY_RULE,
    showsPerson ? PERSON_PHOTO_RULE : "",
    showsFood || (input.menus ?? []).length > 0 || (input.productPhotos ?? []).length > 0 ? FOOD_PHOTO_RULE : "",
    meat,
    menuLine([...(input.menus ?? []), ...(input.productPhotos ?? [])]),
    productPhotoLine(input.productPhotos),
    layout ? `${LAYOUT_LEAD}${layout}${LAYOUT_TAIL}` : "",
    `Title: ${title}.${captionLine}`,
    pages,
    "Write only the headline, small text, small labels, and contact box listed for each page. Draw the picture, and do not turn the picture instructions into text.",
  ].filter(Boolean).join("\n");
  // Pages first: the last page (CTA, required facts) always fits. Scenes stay at least
  // SCENE_FLOOR long while the shared layout can still give up room; the layout keeps
  // LAYOUT_MIN_ROOM before scenes go below their fuller sizes.
  const layoutWanted = commonNote ? Math.min(commonNote.length, LAYOUT_MIN_ROOM) : 0;
  let brief = "";
  for (const sceneLimit of [600, 400, 300, SCENE_FLOOR, 150, 100, 60]) {
    showsFood = false;
    showsPerson = false;
    const pages = buildPages(sceneLimit);
    const bare = assemble(pages, "");
    const room = commonNote ? limitChars - bare.length - LAYOUT_LEAD.length - LAYOUT_TAIL.length - 1 : 0;
    brief = commonNote && room > 0 ? assemble(pages, fitLayoutNote(commonNote, room)) : bare;
    if (brief.length > limitChars) continue;
    if (sceneLimit > SCENE_FLOOR && room < layoutWanted) continue;
    break;
  }
  return brief.slice(0, limitChars);
}
