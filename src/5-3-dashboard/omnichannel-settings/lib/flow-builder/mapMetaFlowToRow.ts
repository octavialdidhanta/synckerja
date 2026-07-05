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

export function mapMetaFlowToRow(flow: MetaWhatsAppFlowApiRow): FlowBuilderListingRow {
  const updatedRaw = flow.updated_time?.trim();
  return {
    id: String(flow.id ?? ""),
    name: String(flow.name ?? ""),
    status: normalizeRowStatus(flow.status),
    createdBy: null,
    lastUpdatedBy: null,
    lastUpdatedAt: updatedRaw ? new Date(updatedRaw).toISOString() : null,
    kind: "meta_form" as const,
  };
}
