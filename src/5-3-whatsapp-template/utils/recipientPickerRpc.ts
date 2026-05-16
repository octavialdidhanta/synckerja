import type { NewLead } from "@/shared/types/leads";
import type { RecipientPickerCandidate } from "@/5-3-whatsapp-template/utils/buildRecipientPickerCandidates";
import type { LatestCustomerSurvey } from "@/features/customer-survey/hooks/useCustomerSurveyForLeads";


/** Single item from `search_whatsapp_recipient_picker` JSON `items[]`. */
export type RecipientPickerRpcItem = NewLead & {
  _phone_normalized: string;
  _display_phone: string;
  _conversation_id: string | null;
  _picker_origin: "lead" | "livechat";
  _lead_id: string | null;
  latest_survey_rating?: number | null;
  latest_survey_comment?: string | null;
  latest_survey_submitted_at?: string | null;
};

export function surveyFromRpcItem(item: RecipientPickerRpcItem): LatestCustomerSurvey | null {
  const rating = item.latest_survey_rating;
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  return {
    conversationId: item._conversation_id != null ? String(item._conversation_id) : "",
    rating: Number(rating),
    comment: item.latest_survey_comment != null ? String(item.latest_survey_comment) : null,
    submittedAt:
      item.latest_survey_submitted_at != null ? String(item.latest_survey_submitted_at) : "",
    assigneeId: null,
    assigneeName: null,
  };
}

export type RecipientPickerSearchPayload = {
  total: number;
  items: RecipientPickerRpcItem[];
};

export function parseRecipientPickerSearchPayload(raw: unknown): RecipientPickerSearchPayload {
  if (raw == null || typeof raw !== "object") {
    return { total: 0, items: [] };
  }
  const o = raw as Record<string, unknown>;
  const total = typeof o.total === "number" ? o.total : Number(o.total ?? 0);
  const itemsRaw = o.items;
  const items: RecipientPickerRpcItem[] = Array.isArray(itemsRaw)
    ? (itemsRaw as RecipientPickerRpcItem[]).map((x) => ({
        ...x,
        lead_status:
          x.lead_status && typeof x.lead_status === "object"
            ? x.lead_status
            : { id: String(x.status_id ?? ""), name: "", color: null },
      }))
    : [];
  return { total: Number.isFinite(total) ? total : 0, items };
}

export function rpcItemToRecipientPickerCandidate(item: RecipientPickerRpcItem): RecipientPickerCandidate {
  const leadId =
    item._lead_id != null && String(item._lead_id).length > 0 ? String(item._lead_id) : null;
  const convId =
    item._conversation_id != null && String(item._conversation_id).length > 0
      ? String(item._conversation_id)
      : null;
  return {
    phoneKey: item._phone_normalized,
    displayPhone: item._display_phone,
    displayName: (item.client ?? "").trim() || item._display_phone,
    lead_id: leadId,
    conversation_id: convId,
    lead_source: item.source ?? null,
    origin: item._picker_origin === "lead" ? "lead" : "livechat",
    priority: item._picker_origin === "lead" ? 100_000 : 50_000,
  };
}
