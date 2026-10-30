export type MaterialSection = {
  heading: string;
  body: string;
  example: string;
};

export type MaterialOutline = {
  title: string;
  displayTitle: string;
  intro: string;
  buttonLabel: string;
  sections: MaterialSection[];
  replies: string[] | null;
};

const MIN_SECTIONS = 3;
const MIN_INTRO = 180;
const MIN_BODY = 320;
const MIN_EXAMPLE = 60;

export function clipButtonLabel(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "Kirim link";
  return text.length <= 20 ? text : text.slice(0, 20);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .join(" ");
      if (joined) return joined;
    }
  }
  return "";
}

function extractJsonObject(text: string): unknown | null {
  const cleaned = text.trim().replace(/^\uFEFF/, "");
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          try {
            return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

export function shortGuideTitle(offer: string, requested: string): string {
  const clean = requested.trim().replace(/\s+/g, " ").replace(/\.+$/, "");
  if (clean.length >= 8 && clean.length <= 72) return clean;
  const sentence = offer.trim().replace(/\s+/g, " ").split(/(?<=\.)\s+/)[0]?.replace(/\.+$/, "") ?? "";
  if (sentence.length >= 8 && sentence.length <= 72) return sentence;
  const cut = (sentence || offer).trim().slice(0, 72);
  const space = cut.lastIndexOf(" ");
  return (space > 24 ? cut.slice(0, space) : cut).trim();
}

function readSections(row: Record<string, unknown>): MaterialSection[] {
  const sectionsRaw = ["sections", "parts", "langkah", "items", "chapters"]
    .map((key) => row[key])
    .find((value) => Array.isArray(value));
  if (!Array.isArray(sectionsRaw)) return [];
  return sectionsRaw.flatMap((item) => {
    const rec = asRecord(item);
    if (!rec) return [];
    const heading = stringField(rec, ["heading", "title", "judul", "name"]).replace(/\s+/g, " ");
    const body = stringField(rec, ["body", "content", "text", "isi", "paragraph", "description"]);
    const example = stringField(rec, ["example", "contoh", "sample"]);
    if (!heading || body.length < MIN_BODY || example.length < MIN_EXAMPLE) return [];
    return [{
      heading: heading.slice(0, 80),
      body: body.slice(0, 4000),
      example: example.slice(0, 800),
    }];
  });
}

export function parseMaterialOutline(text: string, offer: string): MaterialOutline | null {
  const expected = offer.trim();
  if (!expected) return null;
  const raw = extractJsonObject(text);
  const row = asRecord(raw);
  if (!row) return null;
  const intro = stringField(row, ["intro", "pembuka", "overview"]);
  const sections = readSections(row);
  if (intro.length < MIN_INTRO || sections.length < MIN_SECTIONS) return null;
  const repliesRaw = Array.isArray(row.replies)
    ? row.replies.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 3)
    : [];
  const replies = repliesRaw.length === 3 && new Set(repliesRaw).size === 3
    ? repliesRaw.map((reply) => reply.slice(0, 240))
    : null;
  return {
    title: expected,
    displayTitle: shortGuideTitle(expected, stringField(row, ["display_title", "displayTitle", "judul_tampilan"])),
    intro: intro.slice(0, 2000),
    buttonLabel: clipButtonLabel(stringField(row, ["button_label", "buttonLabel", "label"])),
    sections,
    replies,
  };
}

export function materialOutlineRejectReason(text: string, offer: string): string {
  if (parseMaterialOutline(text, offer)) return "";
  if (!offer.trim()) return "missing offer";
  if (!text.includes("{")) return "no json";
  if (!extractJsonObject(text)) return "invalid json";
  return "thin guide";
}

export function claudeOutlineText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  const texts = content.flatMap((block) => {
    const rec = asRecord(block);
    return rec && typeof rec.text === "string" && rec.text.trim() ? [rec.text] : [];
  });
  if (texts.length > 0) return texts.join("\n");
  const blobs: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      if (node.includes("{")) blobs.push(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const value of Object.values(node as Record<string, unknown>)) walk(value);
  };
  walk(content);
  return blobs.sort((a, b) => b.length - a.length)[0] ?? "";
}

export type PdfTurn =
  | { kind: "file"; fileId: string }
  | { kind: "continue"; containerId: string; content: unknown[] }
  | { kind: "stop"; reason: string };

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

/** A PDF skill often pauses mid-turn. Continue only while the same container is still open. */
export function nextPdfTurn(payload: unknown): PdfTurn {
  const fileId = findClaudeFileId(payload);
  if (fileId) return { kind: "file", fileId };
  const row = payloadRecord(payload);
  const stop = String(row?.stop_reason ?? "").trim() || "unknown";
  const container = payloadRecord(row?.container);
  const containerId = String(container?.id ?? "").trim();
  const content = row?.content;
  if ((stop === "pause_turn" || stop === "max_tokens") && containerId && Array.isArray(content)) {
    return { kind: "continue", containerId, content };
  }
  return { kind: "stop", reason: stop };
}

export function findClaudeFileId(payload: unknown): string | null {
  let found: string | null = null;
  const walk = (node: unknown) => {
    if (found || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const rec = node as Record<string, unknown>;
    const fileId = rec.file_id;
    if (typeof fileId === "string" && fileId.startsWith("file_")) {
      found = fileId;
      return;
    }
    for (const value of Object.values(rec)) walk(value);
  };
  walk(payload);
  return found;
}
