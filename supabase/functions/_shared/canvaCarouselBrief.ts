export type CarouselSlide = {
  label: string;
  scene: string;
};

function cells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split("|").map((cell) => cell.replace(/\s+/g, " ").trim());
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Scene text from the storyboard. The image column stays empty; the words
 * Canva needs are in Scene Visual.
 */
export function carouselSlidesFromBrief(markdown: string): CarouselSlide[] {
  const lines = String(markdown ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("synckerja-brief"));
  if (lines.length < 2) return [];

  const headers = cells(lines[0]).map(headerKey);
  const sceneIndex = headers.findIndex((header) => header.includes("scene"));
  const visualIndex = headers.findIndex((header) => header === "visual");
  const textIndex = sceneIndex >= 0 ? sceneIndex : visualIndex;
  const timingIndex = headers.findIndex((header) => header === "timing" || header === "no" || header === "#");
  if (textIndex < 0) return [];

  const slides: CarouselSlide[] = [];
  for (const line of lines.slice(1)) {
    if (/^\|\s*:?-{3,}/.test(line)) continue;
    const row = cells(line);
    const timing = timingIndex >= 0 ? row[timingIndex] ?? "" : "";
    if (timing && !/^slide\s+\d+\b/i.test(timing)) continue;
    const scene = (row[textIndex] ?? "").trim();
    if (!scene) continue;
    const number = slides.length + 1;
    const label = /^slide\s+\d+\b/i.test(timing) ? timing : `Slide ${number}`;
    slides.push({ label, scene: scene.slice(0, 500) });
    if (slides.length >= 10) break;
  }
  return slides;
}

export function buildCanvaCarouselBrief(input: {
  title: string;
  caption: string;
  slides: CarouselSlide[];
}): string {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 200) || "Carousel";
  const caption = input.caption.replace(/\s+/g, " ").trim().slice(0, 400);
  const pages = input.slides
    .map((slide, index) => `${slide.label || `Slide ${index + 1}`}: ${slide.scene}`)
    .join("\n");
  const captionLine = caption ? `\nCaption: ${caption}` : "";
  return [
    `Instagram carousel, portrait 4:5, ${input.slides.length} pages, one page per slide.`,
    `Subject: ${title}.${captionLine}`,
    pages,
    "Each page is editable. Keep the 4:5 portrait ratio. Do not make a square.",
  ].join("\n").slice(0, 6000);
}
