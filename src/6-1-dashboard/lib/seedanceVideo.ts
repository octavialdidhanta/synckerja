import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import { locationFrameForContentType, type LocationFrame } from "@/6-1-dashboard/modal/briefConceptAssets";

export const SEEDANCE_MODELS = [
  { id: "dreamina-seedance-2-5-260628", label: "Seedance 2.5" },
  { id: "dreamina-seedance-2-0-260128", label: "Seedance 2.0" },
] as const;

export type SeedanceModelId = (typeof SEEDANCE_MODELS)[number]["id"];

export const SEEDANCE_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export type SeedanceResolution = (typeof SEEDANCE_RESOLUTIONS)[number];

export const UGC_TYPES = [
  "Problem Solution",
  "Product Demo",
  "Unboxing",
  "Testimonial",
  "ASMR",
  "Affiliate Sell",
] as const;
export type UgcType = (typeof UGC_TYPES)[number];

export type VideoRatio = "9:16" | "4:5" | "1:1" | "16:9";

const MENTION = /@(?:location|character|property)_[a-z0-9_]+/gi;

export function isSeedanceModel(value: string): value is SeedanceModelId {
  return SEEDANCE_MODELS.some((model) => model.id === value);
}

export function durationLimit(model: SeedanceModelId): number {
  return model === "dreamina-seedance-2-0-260128" ? 15 : 30;
}

export function durationChoices(model: SeedanceModelId): number[] {
  const max = durationLimit(model);
  const choices: number[] = [];
  for (let seconds = 5; seconds <= max; seconds += 5) choices.push(seconds);
  return choices;
}

export function durationIsValid(model: SeedanceModelId, seconds: number): boolean {
  return durationChoices(model).includes(seconds);
}

export function labeledLine(text: string, label: string): string {
  const match = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? "";
}

export function readLook(masterPrompt: string): string {
  return labeledLine(masterPrompt, "Look");
}

export function lookIsUgc(look: string): boolean {
  return /\bugc\b/i.test(look);
}

export function audioForbidden(masterPrompt: string): boolean {
  const line = labeledLine(masterPrompt, "Audio");
  if (!line) return false;
  return /no sound|no music|silent|senyap|tanpa suara|tanpa musik|tanpa bunyi/i.test(line);
}

export function mentionedConceptHandles(text: string): string[] {
  return [...new Set((text.match(MENTION) ?? []).map((handle) => handle.toLowerCase()))];
}

export function conceptImagePath(concept: BriefConceptDocument | null | undefined, handle: string): string | null {
  const key = handle.toLowerCase();
  const character = concept?.characters.find((item) => item.handle.toLowerCase() === key);
  if (character) return character.portraitPath || character.bodyPath || null;
  const location = concept?.locations.find((item) => item.handle.toLowerCase() === key);
  if (location) return location.locationPath || null;
  const property = concept?.properties.find((item) => item.handle.toLowerCase() === key);
  if (property) return property.propertyPath || null;
  return null;
}

export function missingConceptImages(text: string, concept: BriefConceptDocument | null | undefined): string[] {
  return mentionedConceptHandles(text).filter((handle) => !conceptImagePath(concept, handle));
}

export function videoRatioForContent(contentTypeName: string, postAspect?: "4:5" | "1:1"): VideoRatio {
  const frame: LocationFrame | null = locationFrameForContentType(contentTypeName, postAspect);
  if (frame) return frame;
  const shape = contentTypeName.trim().toLowerCase();
  if (shape === "post" || shape === "carousel") return "4:5";
  return "16:9";
}

export function imageRatioDiffers(width: number | null | undefined, height: number | null | undefined, ratio: VideoRatio): boolean {
  if (!width || !height || width <= 0 || height <= 0) return false;
  const targets: Record<VideoRatio, number> = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9 };
  const actual = width / height;
  return Math.abs(actual - targets[ratio]) / targets[ratio] > 0.12;
}

function cell(headers: string[], row: string[], match: (header: string) => boolean): string {
  const index = headers.findIndex((header) => match(header.trim().toLowerCase()));
  return index >= 0 ? String(row[index] ?? "").trim() : "";
}

export function masterPromptColumn(headers: string[]): number {
  return headers.findIndex((header) => header.trim().toLowerCase() === "master prompt");
}

export function coveringMasterRow(rows: string[][], headers: string[], rowIndex: number): number {
  const column = masterPromptColumn(headers);
  if (column < 0) return rowIndex;
  let cursor = Math.min(rowIndex, rows.length - 1);
  while (cursor > 0 && !String(rows[cursor]?.[column] ?? "").trim()) cursor -= 1;
  return cursor;
}

export function masterGroupRows(rows: string[][], headers: string[], anchor: number): number[] {
  const column = masterPromptColumn(headers);
  const start = coveringMasterRow(rows, headers, anchor);
  if (column < 0) return [start];
  const indexes = [start];
  for (let next = start + 1; next < rows.length; next += 1) {
    if (String(rows[next]?.[column] ?? "").trim()) break;
    const voice = cell(headers, rows[next] ?? [], (header) => header === "vo" || header.includes("voice") || header.includes("narasi"));
    if (voice) break;
    indexes.push(next);
  }
  return indexes;
}

export type ShotBrief = {
  shot: string;
  angle: string;
  visualFunction: string;
  veoPrompt: string;
};

export function isVeoPromptHeader(header: string): boolean {
  const normalized = header.trim().toLowerCase();
  return normalized.includes("veo") || (normalized.includes("prompt") && !normalized.includes("master") && !normalized.includes("visual function"));
}

export function readShotBrief(headers: string[], row: string[], veoOverride?: string | null): ShotBrief {
  const stored = cell(headers, row, isVeoPromptHeader);
  return {
    shot: cell(headers, row, (header) => header === "shot" || header.startsWith("shot")),
    angle: cell(headers, row, (header) => header === "angle" || header.startsWith("angle")),
    visualFunction: cell(headers, row, (header) => header.includes("visual function")),
    veoPrompt: veoOverride?.trim() || stored,
  };
}

/** First number in the Shot cell. Words after it stay in the cell; the card title uses only this number. */
export function shootNumberFromShotLabel(shot: string, fallback: number): number {
  const match = shot.match(/\d+/);
  if (!match) return fallback;
  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** First card of a number stays "1". The next same number in that scene becomes "1.1", then "1.2". */
export function shootHeaderLabels(numbers: number[]): string[] {
  const seen = new Map<number, number>();
  return numbers.map((number) => {
    const previous = seen.get(number) ?? 0;
    seen.set(number, previous + 1);
    return previous === 0 ? String(number) : `${number}.${previous}`;
  });
}

export function promptSlideForImage(override: string | null | undefined, original: string): { text: string; locked: boolean } {
  const edited = override?.trim() ?? "";
  if (edited) return { text: edited, locked: true };
  return { text: original, locked: false };
}

export function veoColumnUsesSlides(images: Array<{ prompt_override?: string | null }>): boolean {
  return images.length > 1 || Boolean(images[0]?.prompt_override?.trim());
}

export function readNarration(headers: string[], rows: string[][], rowIndexes: number[]): string {
  return rowIndexes
    .map((index) => cell(headers, rows[index] ?? [], (header) => header === "vo" || header.includes("voice") || header.includes("narasi")))
    .filter(Boolean)
    .join("\n\n");
}

function shotLines(headers: string[], row: string[], veoOverride?: string | null, frame: "full" | "ending" = "full"): string[] {
  const brief = readShotBrief(headers, row, veoOverride);
  const pairs: Array<[string, string]> = [];
  if (frame === "full") pairs.push(["Shot", brief.shot]);
  pairs.push(
    ["Angle", brief.angle],
    ["Visual function", brief.visualFunction],
    ["Veo 3 prompt", brief.veoPrompt],
  );
  if (frame === "full") {
    pairs.push(["Voice", cell(headers, row, (header) => header === "vo" || header.includes("voice") || header.includes("narasi"))]);
  }
  return pairs.flatMap(([label, value]) => (value ? [`${label}: ${value}`] : []));
}

export function buildVideoPrompt(input: {
  scope: "shot" | "master";
  rows: string[][];
  headers: string[];
  rowIndexes: number[];
  ugcType?: string | null;
  veoByRow?: Record<number, string | null | undefined>;
  endVeo?: string | null;
}): string {
  const anchor = coveringMasterRow(input.rows, input.headers, input.rowIndexes[0] ?? 0);
  const master = cell(input.headers, input.rows[anchor] ?? [], (header) => header === "master prompt");
  const look = readLook(master);
  const lines = [
    look ? `Look: ${look}` : "",
    input.ugcType?.trim() ? `UGC type: ${input.ugcType.trim()}` : "",
    master ? `Master prompt:\n${master}` : "",
  ];
  const ending = input.scope === "shot" ? input.endVeo?.trim() ?? "" : "";
  input.rowIndexes.forEach((index, order) => {
    const row = input.rows[index] ?? [];
    if (ending) {
      const opening = shotLines(input.headers, row, input.veoByRow?.[index]);
      const close = shotLines(input.headers, row, ending, "ending");
      if (opening.length > 0) lines.push(`Opening frame:\n${opening.join("\n")}`);
      if (close.length > 0) lines.push(`Ending frame:\n${close.join("\n")}`);
      return;
    }
    const shot = shotLines(input.headers, row, input.veoByRow?.[index]);
    if (shot.length === 0) return;
    lines.push(input.scope === "master" ? `Shot ${order + 1}:\n${shot.join("\n")}` : shot.join("\n"));
  });
  return lines.filter(Boolean).join("\n\n").trim();
}
