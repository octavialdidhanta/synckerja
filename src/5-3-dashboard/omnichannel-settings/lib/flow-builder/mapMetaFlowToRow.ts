import type {
  FlowBuilderListingRow,
  MetaWhatsAppFlowApiRow,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

function normalizeRowStatus(raw: string | undefined): FlowBuilderListingRow["status"] {
  const status = String(raw ?? "").trim().toUpperCase();
  if (status === "PUBLISHED" || status === "ACTIVE") return "ACTIVE";
  if (status === "DRAFT") return "DRAFT";
  return "OTHER";
}

/** Parse Meta WhatsApp Flow updated timestamp (ISO string or Unix seconds/ms). */
export function parseMetaFlowUpdatedAt(raw: unknown): string | null {
  if (raw == null) return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

export function mapMetaFlowToRow(flow: MetaWhatsAppFlowApiRow): FlowBuilderListingRow {
  const lastUpdatedAt =
    parseMetaFlowUpdatedAt(flow.updated_at) ?? parseMetaFlowUpdatedAt(flow.updated_time);

  return {
    id: String(flow.id ?? ""),
    name: String(flow.name ?? ""),
    status: normalizeRowStatus(flow.status),
    createdBy: null,
    lastUpdatedBy: null,
    lastUpdatedAt,
    kind: "meta_form" as const,
  };
}
