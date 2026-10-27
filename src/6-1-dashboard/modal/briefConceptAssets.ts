export type BriefConceptAsset = {
  handle: string;
  description: string;
  portraitPath?: string;
  bodyPath?: string;
  locationPath?: string;
  propertyPath?: string;
  visualRevision?: number;
};

export type BriefPostAspect = "4:5" | "1:1";

export type LocationFrame = "9:16" | BriefPostAspect | "16:9";

export type BriefConceptDocument = {
  voiceOver?: string;
  locations: BriefConceptAsset[];
  characters: BriefConceptAsset[];
  properties: BriefConceptAsset[];
  postAspect?: BriefPostAspect;
};

const VISUAL_PATH =
  /^[0-9a-f-]{36}\/(?:thinking-lab|brief)\/[0-9a-f-]{36}\/[a-z0-9_]{1,60}-(portrait|body)\.(jpg|png)$/i;

const LOCATION_PATH =
  /^[0-9a-f-]{36}\/(?:thinking-lab|brief)\/[0-9a-f-]{36}\/[a-z0-9_]{1,60}-location\.(jpg|png)$/i;

const PROPERTY_PATH =
  /^[0-9a-f-]{36}\/(?:thinking-lab|brief)\/[0-9a-f-]{36}\/[a-z0-9_]{1,60}-property\.(jpg|png)$/i;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Keep spaces while typing. Trim only empty-only strings so JSON nullish text still clears. */
function asDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim() === "" ? "" : value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function briefAssetHandle(name: string, prefix: "location" | "character" | "property"): string {
  const body = name
    .replace(/^@+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const key = body.startsWith(`${prefix}_`) ? body : `${prefix}_${body || "item"}`;
  return `@${key}`;
}

function readVisualPath(value: unknown, kind: "portrait" | "body"): string | undefined {
  const text = asText(value);
  const match = VISUAL_PATH.exec(text);
  if (!match || match[1].toLowerCase() !== kind) return undefined;
  return text;
}

function readLocationPath(value: unknown): string | undefined {
  const text = asText(value);
  return LOCATION_PATH.test(text) ? text : undefined;
}

function readPropertyPath(value: unknown): string | undefined {
  const text = asText(value);
  return PROPERTY_PATH.test(text) ? text : undefined;
}

function readRevision(value: unknown): number | undefined {
  const revision = Number(value);
  if (!Number.isFinite(revision) || revision <= 0) return undefined;
  return Math.floor(revision);
}

function readAssets(value: unknown, mode: "text" | "character" | "location" | "property"): BriefConceptAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const handle = asText(row.handle);
    const description = asDescription(row.description);
    if (!handle.startsWith("@")) return [];
    const asset: BriefConceptAsset = { handle, description };
    if (mode === "character") {
      const portraitPath = readVisualPath(row.portraitPath, "portrait");
      const bodyPath = readVisualPath(row.bodyPath, "body");
      if (portraitPath) asset.portraitPath = portraitPath;
      if (bodyPath) asset.bodyPath = bodyPath;
    }
    if (mode === "location") {
      const locationPath = readLocationPath(row.locationPath);
      if (locationPath) asset.locationPath = locationPath;
    }
    if (mode === "property") {
      const propertyPath = readPropertyPath(row.propertyPath);
      if (propertyPath) asset.propertyPath = propertyPath;
    }
    if (mode !== "text") {
      const revision = readRevision(row.visualRevision);
      if (revision) asset.visualRevision = revision;
    }
    return [asset];
  });
}

export function locationContentShape(contentTypeName: string): "vertical" | "landscape" | "feed" | "unknown" {
  const name = contentTypeName.trim().toLowerCase();
  if (name === "reel" || name === "story") return "vertical";
  if (name === "youtube") return "landscape";
  if (name === "post" || name === "carousel") return "feed";
  return "unknown";
}

export function locationFrameForContentType(
  contentTypeName: string,
  postAspect?: BriefPostAspect,
): LocationFrame | null {
  const shape = locationContentShape(contentTypeName);
  if (shape === "vertical") return "9:16";
  if (shape === "landscape") return "16:9";
  if (shape === "feed") return postAspect ?? null;
  return null;
}

export function emptyBriefConcept(): BriefConceptDocument {
  return { locations: [], characters: [], properties: [] };
}

export function serializeBriefConcept(document: BriefConceptDocument): string {
  const voiceOver = document.voiceOver?.trim() ?? "";
  return JSON.stringify({
    v: 1,
    ...(voiceOver ? { voiceOver } : {}),
    ...(document.postAspect ? { postAspect: document.postAspect } : {}),
    locations: document.locations,
    characters: document.characters,
    properties: document.properties,
  });
}

function readPostAspect(value: unknown): BriefPostAspect | undefined {
  return value === "4:5" || value === "1:1" ? value : undefined;
}

export function parseBriefConcept(raw: string): BriefConceptDocument | null {
  const text = raw.trim();
  if (!text) return emptyBriefConcept();
  if (!text.startsWith("{")) return null;
  try {
    const row = JSON.parse(text) as { v?: unknown; voiceOver?: unknown; postAspect?: unknown; locations?: unknown; characters?: unknown; properties?: unknown };
    if (row.v !== 1) return null;
    const postAspect = readPostAspect(row.postAspect);
    const voiceOver = asText(row.voiceOver);
    return {
      ...(voiceOver ? { voiceOver } : {}),
      ...(postAspect ? { postAspect } : {}),
      locations: readAssets(row.locations, "location"),
      characters: readAssets(row.characters, "character"),
      properties: readAssets(row.properties, "property"),
    };
  } catch {
    return null;
  }
}

function keepStoredVisual(next: BriefConceptAsset, previous?: BriefConceptAsset): BriefConceptAsset {
  if (!previous) return next;
  const portraitPath = next.portraitPath ?? previous.portraitPath;
  const bodyPath = next.bodyPath ?? previous.bodyPath;
  const locationPath = next.locationPath ?? previous.locationPath;
  const propertyPath = next.propertyPath ?? previous.propertyPath;
  const visualRevision = next.visualRevision ?? previous.visualRevision;
  return {
    ...next,
    ...(portraitPath ? { portraitPath } : {}),
    ...(bodyPath ? { bodyPath } : {}),
    ...(locationPath ? { locationPath } : {}),
    ...(propertyPath ? { propertyPath } : {}),
    ...(visualRevision ? { visualRevision } : {}),
  };
}

/** Keep images already stored on the plan when Thinking Lab saves the concept again. */
export function mergeBriefConceptVisuals(previousRaw: string | null | undefined, nextRaw: string): string {
  const next = parseBriefConcept(nextRaw);
  const previous = previousRaw ? parseBriefConcept(previousRaw) : null;
  if (!next || !previous) return nextRaw;
  const locations = new Map(previous.locations.map((item) => [item.handle, item]));
  const characters = new Map(previous.characters.map((item) => [item.handle, item]));
  const properties = new Map(previous.properties.map((item) => [item.handle, item]));
  return serializeBriefConcept({
    ...next,
    voiceOver: next.voiceOver?.trim() || previous.voiceOver,
    postAspect: next.postAspect ?? previous.postAspect,
    locations: next.locations.map((item) => keepStoredVisual(item, locations.get(item.handle))),
    characters: next.characters.map((item) => keepStoredVisual(item, characters.get(item.handle))),
    properties: next.properties.map((item) => keepStoredVisual(item, properties.get(item.handle))),
  });
}

export function briefConceptHasContent(document: BriefConceptDocument): boolean {
  return Boolean(document.voiceOver?.trim()) || document.locations.length + document.characters.length + document.properties.length > 0;
}
