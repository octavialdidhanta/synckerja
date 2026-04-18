import type { MetaMessageTemplate, TemplateTableRow } from "../types";
import { languageCodeToLabel } from "./languageDisplay";

function extractBodyPreview(components: MetaMessageTemplate["components"]): string {
  if (!Array.isArray(components)) return "";
  const body = components.find((c) => (c?.type ?? "").toUpperCase() === "BODY");
  const text = (body?.text ?? "").replace(/\s+/g, " ").trim();
  return text.slice(0, 120);
}

function categoryToDisplay(category: string | undefined): { display: string; filter: string } {
  const c = (category ?? "").toUpperCase();
  if (c === "MARKETING") return { display: "Marketing", filter: "Marketing" };
  if (c === "UTILITY") return { display: "Utility", filter: "Utility" };
  if (c === "AUTHENTICATION") return { display: "Authentication", filter: "Authentication" };
  const raw = (category ?? "").trim();
  return { display: raw || "—", filter: raw || "—" };
}

/** Map Meta API template status to Manager-style label + block reason hint. */
function statusToDisplay(meta: MetaMessageTemplate): { label: string; topBlock: string | null } {
  const s = (meta.status ?? "").toUpperCase().trim();
  const rejected = (meta.rejected_reason ?? "").trim();

  if (s === "APPROVED") {
    return { label: "Active – Quality pending", topBlock: null };
  }
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

export function mapMetaTemplateToRow(meta: MetaMessageTemplate): TemplateTableRow | null {
  const id = meta.id != null ? String(meta.id) : "";
  const name = (meta.name ?? "").trim();
  if (!id || !name) return null;

  const bodyPreview = extractBodyPreview(meta.components);
  const { display: categoryDisplay, filter: categoryFilter } = categoryToDisplay(meta.category);
  const languageCode = (meta.language ?? "").trim() || "—";
  const languageLabel = languageCode === "—" ? "—" : languageCodeToLabel(languageCode);

  const { label: statusLabel, topBlock } = statusToDisplay(meta);

  return {
    id,
    templateName: name,
    bodyPreview,
    categoryDisplay,
    categoryFilter,
    languageCode,
    languageLabel,
    languagePreview: bodyPreview,
    statusLabel,
    statusRaw: (meta.status ?? "").toUpperCase(),
    messagesDelivered: null,
    readRatePercent: null,
    topBlockReason: topBlock,
    lastEditedAt: null,
  };
}
