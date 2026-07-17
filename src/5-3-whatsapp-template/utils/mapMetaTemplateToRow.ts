import type { MetaMessageTemplate, TemplateTableRow } from "../types";
import { metaLanguageToShortTag } from "./languageDisplay";
import {
  extractFlowIdsFromTemplateComponents,
  templateHasFlowButton,
} from "./extractFlowIdsFromTemplateComponents";

const MEDIA_HEADER_FORMATS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

/** Meta returns ISO-like strings (e.g. `2024-01-15T12:00:00+0000`). */
function parseMetaGraphDateTime(raw: string | undefined | null): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

/** Media header: Meta `HEADER.format` is `IMAGE` | `VIDEO` | `DOCUMENT` (not `TEXT`). */
function extractHeaderMediaFormat(components: MetaMessageTemplate["components"]): string | null {
  if (!Array.isArray(components)) return null;
  for (const c of components) {
    if (String(c?.type ?? "").toUpperCase() !== "HEADER") continue;
    const fmt = String(c?.format ?? "").toUpperCase().trim();
    if (MEDIA_HEADER_FORMATS.has(fmt)) return fmt;
  }
  return null;
}

/** Table column: media type or TEXT header; null = body-only template. */
function mediaFormatForTable(
  components: MetaMessageTemplate["components"],
  headerText: string | null,
): string | null {
  const media = extractHeaderMediaFormat(components);
  if (media) return media;
  if (headerText?.trim()) return "TEXT";
  return null;
}

function extractMessagesDelivered(meta: MetaMessageTemplate): number | null {
  const raw = meta._template_analytics?.messages_delivered;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function extractReadRatePercent(meta: MetaMessageTemplate): number | null {
  const analytics = meta._template_analytics;
  if (!analytics) return null;
  const delivered = Number(analytics.messages_delivered ?? 0);
  const read = Number(analytics.messages_read ?? 0);
  if (!Number.isFinite(delivered) || delivered <= 0) return null;
  if (!Number.isFinite(read) || read < 0) return null;
  return Math.round((read / delivered) * 1000) / 10;
}

function extractBodyFull(components: MetaMessageTemplate["components"]): string {
  if (!Array.isArray(components)) return "";
  const body = components.find((c) => (c?.type ?? "").toUpperCase() === "BODY");
  return String(body?.text ?? "").trim();
}

function extractBodyPreviewSnippet(bodyFull: string): string {
  const text = bodyFull.replace(/\s+/g, " ").trim();
  return text.slice(0, 120);
}

/** TEXT header (excludes IMAGE/VIDEO/DOCUMENT headers). */
function extractHeaderText(components: MetaMessageTemplate["components"]): string | null {
  if (!Array.isArray(components)) return null;
  for (const c of components) {
    if (String(c?.type ?? "").toUpperCase() !== "HEADER") continue;
    const fmt = String(c?.format ?? "").toUpperCase().trim();
    if (MEDIA_HEADER_FORMATS.has(fmt)) return null;
    const t = String(c?.text ?? "").trim();
    return t || null;
  }
  return null;
}

function extractFooterText(components: MetaMessageTemplate["components"]): string | null {
  if (!Array.isArray(components)) return null;
  const f = components.find((c) => (c?.type ?? "").toUpperCase() === "FOOTER");
  const t = String(f?.text ?? "").trim();
  return t || null;
}

function extractBodyVariableExamples(components: MetaMessageTemplate["components"]): string[] {
  if (!Array.isArray(components)) return [];
  const body = components.find((c) => (c?.type ?? "").toUpperCase() === "BODY");
  const ex = body?.example;
  if (!ex || typeof ex !== "object") return [];
  const rows = (ex as { body_text?: unknown }).body_text;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const first = rows[0];
  if (Array.isArray(first)) return first.map((x) => String(x ?? "").trim());
  /** Rare: Meta may return a flat string array for one row. */
  if (rows.every((x) => typeof x === "string" || typeof x === "number")) {
    return rows.map((x) => String(x ?? "").trim());
  }
  return [];
}

function extractHeaderVariableExamples(components: MetaMessageTemplate["components"]): string[] {
  if (!Array.isArray(components)) return [];
  for (const c of components) {
    if (String(c?.type ?? "").toUpperCase() !== "HEADER") continue;
    const fmt = String(c?.format ?? "").toUpperCase().trim();
    if (MEDIA_HEADER_FORMATS.has(fmt)) continue;
    const ex = c.example;
    if (!ex || typeof ex !== "object") return [];
    const rows = (ex as { header_text?: unknown }).header_text;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const first = rows[0];
    if (Array.isArray(first)) return first.map((x) => String(x ?? "").trim());
    if (rows.every((x) => typeof x === "string" || typeof x === "number")) {
      return rows.map((x) => String(x ?? "").trim());
    }
    return [];
  }
  return [];
}

/** Meta may return a public URL in `header_handle`; opaque resumable handles are not loadable in-browser. */
function extractHeaderMediaPreviewUrl(components: MetaMessageTemplate["components"]): string | null {
  if (!Array.isArray(components)) return null;
  for (const c of components) {
    if (String(c?.type ?? "").toUpperCase() !== "HEADER") continue;
    const fmt = String(c?.format ?? "").toUpperCase().trim();
    if (!MEDIA_HEADER_FORMATS.has(fmt)) continue;
    const ex = c.example;
    if (!ex || typeof ex !== "object") return null;
    const handles = (ex as { header_handle?: unknown }).header_handle;
    if (!Array.isArray(handles)) return null;
    for (const h of handles) {
      const s = String(h ?? "").trim();
      if (/^https?:\/\//i.test(s)) return s;
    }
  }
  return null;
}

function extractPreviewButtonLabels(components: MetaMessageTemplate["components"]): string[] {
  if (!Array.isArray(components)) return [];
  const block = components.find((c) => String(c?.type ?? "").toUpperCase() === "BUTTONS");
  const raw = block?.buttons;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const bt = String((b as { type?: string }).type ?? "").toUpperCase();
    const text = String((b as { text?: string }).text ?? "").trim();
    const phone = String((b as { phone_number?: string }).phone_number ?? "").trim();
    if (bt === "QUICK_REPLY") {
      out.push(text || "Balasan");
    } else if (bt === "URL") {
      out.push(text || "Website");
    } else if (bt === "PHONE_NUMBER") {
      out.push(text || phone || "Telepon");
    } else if (bt === "FLOW") {
      out.push(text || "Buka alur");
    } else if (bt === "VOICE_CALL") {
      out.push(text || "Panggilan");
    } else if (bt === "COPY_CODE") {
      out.push("Salin kode");
    } else if (text) {
      out.push(text);
    }
  }
  return out;
}

function categoryToDisplay(category: string | undefined): { display: string; filter: string } {
  const c = (category ?? "").toUpperCase();
  if (c === "MARKETING") return { display: "Marketing", filter: "Marketing" };
  if (c === "UTILITY") return { display: "Utility", filter: "Utility" };
  if (c === "AUTHENTICATION") return { display: "Authentication", filter: "Authentication" };
  const raw = (category ?? "").trim();
  return { display: raw || "—", filter: raw || "—" };
}

function parseMetaQualityScoreRaw(meta: MetaMessageTemplate): { raw: string; fromMeta: boolean } {
  const qs = meta.quality_score;
  let fromMeta = false;

  if (typeof qs === "string" && qs.trim()) {
    return { raw: qs.toUpperCase().trim(), fromMeta: true };
  }
  if (qs && typeof qs === "object") {
    const score = String((qs as { score?: string }).score ?? "").toUpperCase().trim();
    if (score) return { raw: score, fromMeta: true };
    fromMeta = true;
  }

  const legacy = String(meta.quality_rating ?? "").toUpperCase().trim();
  if (legacy) {
    const legacyMap: Record<string, string> = {
      HIGH: "GREEN",
      MEDIUM: "YELLOW",
      LOW: "RED",
      UNKNOWN: "UNKNOWN",
      GREEN: "GREEN",
      YELLOW: "YELLOW",
      RED: "RED",
    };
    return { raw: legacyMap[legacy] ?? legacy, fromMeta: true };
  }

  if (qs != null) fromMeta = true;
  return { raw: "", fromMeta };
}

/** Meta `quality_score.score` → label shown in CRM (aligned with WhatsApp Manager). */
export function qualityScoreToDisplayLabel(scoreRaw: string): string {
  switch (scoreRaw) {
    case "GREEN":
      return "High quality";
    case "YELLOW":
      return "Medium quality";
    case "RED":
      return "Low quality";
    case "UNKNOWN":
      return "Quality pending";
    default:
      return scoreRaw ? scoreRaw : "—";
  }
}

function qualityToDisplay(meta: MetaMessageTemplate): { label: string; raw: string; fromMeta: boolean } {
  const status = (meta.status ?? "").toUpperCase().trim();
  const { raw: scoreRaw, fromMeta } = parseMetaQualityScoreRaw(meta);

  if (status !== "APPROVED") {
    return { label: "—", raw: "", fromMeta: false };
  }

  if (!fromMeta) {
    return { label: "—", raw: "", fromMeta: false };
  }

  if (!scoreRaw || scoreRaw === "UNKNOWN") {
    return { label: "Quality pending", raw: "UNKNOWN", fromMeta: true };
  }

  return { label: qualityScoreToDisplayLabel(scoreRaw), raw: scoreRaw, fromMeta: true };
}

/** Map Meta API template `status` only (quality is separate). */
function statusToDisplay(meta: MetaMessageTemplate): { label: string; topBlock: string | null } {
  const s = (meta.status ?? "").toUpperCase().trim();
  const rejected = (meta.rejected_reason ?? "").trim();

  if (s === "APPROVED") return { label: "Approved", topBlock: null };
  if (s === "PENDING") return { label: "In review", topBlock: null };
  if (s === "IN_APPEAL") return { label: "Appealed – In review", topBlock: null };
  if (s === "PAUSED") return { label: "Paused", topBlock: rejected || null };
  if (s === "REJECTED") return { label: "Rejected", topBlock: rejected || "—" };
  if (s === "DISABLED") return { label: "Disabled", topBlock: rejected || null };
  if (s === "PENDING_DELETION" || s === "DELETED") return { label: "Archived", topBlock: null };
  if (s === "FLAGGED" || s === "LIMIT_EXCEEDED") {
    return { label: "Paused", topBlock: rejected || s };
  }
  return { label: s || "In review", topBlock: rejected || null };
}

/** Meta sample / system templates excluded from CRM lists and pickers. */
const HIDDEN_META_TEMPLATE_NAMES = new Set(["hello_world"]);

export function isHiddenMetaTemplateName(name: string): boolean {
  return HIDDEN_META_TEMPLATE_NAMES.has(name.trim().toLowerCase());
}

export function mapMetaTemplateToRow(meta: MetaMessageTemplate): TemplateTableRow | null {
  const id = meta.id != null ? String(meta.id) : "";
  const name = (meta.name ?? "").trim();
  if (!id || !name) return null;
  if (isHiddenMetaTemplateName(name)) return null;

  const bodyFull = extractBodyFull(meta.components);
  const bodyPreview = extractBodyPreviewSnippet(bodyFull);
  const headerText = extractHeaderText(meta.components);
  const footerText = extractFooterText(meta.components);
  const previewButtonLabels = extractPreviewButtonLabels(meta.components);
  const bodyVariableExamples = extractBodyVariableExamples(meta.components);
  const headerVariableExamples = extractHeaderVariableExamples(meta.components);
  const headerMediaPreviewUrl = extractHeaderMediaPreviewUrl(meta.components);
  const { display: categoryDisplay, filter: categoryFilter } = categoryToDisplay(meta.category);
  const rawLang = (meta.language ?? "").trim();
  const languageCode = rawLang || "—";
  /** Table + filters: compact tag from Meta `language` only (see `metaLanguageToShortTag`). */
  const languageLabel = rawLang ? metaLanguageToShortTag(rawLang) : "—";

  const { label: statusLabel, topBlock } = statusToDisplay(meta);
  const { label: qualityLabel, raw: qualityRaw, fromMeta: qualityFromMeta } = qualityToDisplay(meta);

  const lastEditedAt = parseMetaGraphDateTime(meta.last_updated_time);
  const createdFromMeta = parseMetaGraphDateTime(meta.created_time);
  /** Prefer Meta `created_time`; if absent, Meta still exposes `last_updated_time` on the template node. */
  const createdAt = createdFromMeta ?? lastEditedAt;
  const mediaFormat = mediaFormatForTable(meta.components, headerText);
  const linkedFlowIds = extractFlowIdsFromTemplateComponents(meta.components);
  const hasFlowButton = templateHasFlowButton(meta.components);

  return {
    id,
    templateName: name,
    bodyPreview,
    bodyFull,
    headerText,
    footerText,
    previewButtonLabels,
    bodyVariableExamples,
    headerVariableExamples,
    headerMediaPreviewUrl,
    categoryDisplay,
    categoryFilter,
    languageCode,
    languageLabel,
    statusLabel,
    statusRaw: (meta.status ?? "").toUpperCase(),
    qualityLabel,
    qualityRaw,
    qualityFromMeta,
    messagesDelivered: extractMessagesDelivered(meta),
    readRatePercent: extractReadRatePercent(meta),
    topBlockReason: topBlock,
    createdAt,
    lastEditedAt,
    mediaFormat,
    hasFlowButton,
    linkedFlowIds,
    componentsJson: meta.components ?? [],
  };
}
