/**
 * Where a Click-to-WhatsApp (ctwa_clid) conversion must be sent.
 *
 * Meta "Conversions API for Business Messaging" (WhatsApp):
 * - events go to the dataset of the WhatsApp Business Account (POST /{WABA_ID}/dataset returns or creates it),
 * - user_data must carry whatsapp_business_account_id + ctwa_clid,
 * - the token needs whatsapp_business_management + whatsapp_business_manage_events
 *   (the WhatsApp Embedded Signup token, not the Meta Ads token).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type CtwaDestination = {
  wabaId: string;
  accessToken: string;
  datasetId: string;
};

export type CtwaDestinationResult =
  | { ok: true; destination: CtwaDestination }
  | { ok: false; reason: string; detail?: unknown };

type AccountRow = {
  whatsapp_business_account_id: string | null;
  phone_number_id: string | null;
  meta_access_token: string | null;
  capi_dataset_id: string | null;
};

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Picks the WhatsApp account that received the ad click; falls back to the only WABA of the org. */
export function pickCtwaAccount(rows: AccountRow[], phoneNumberId: string | null): AccountRow | null {
  const usable = rows.filter((r) => digits(r.whatsapp_business_account_id) && String(r.meta_access_token ?? "").trim());
  if (usable.length === 0) return null;
  if (phoneNumberId) {
    const match = usable.find((r) => String(r.phone_number_id ?? "").trim() === phoneNumberId);
    if (match) return match;
  }
  const wabas = new Set(usable.map((r) => digits(r.whatsapp_business_account_id)));
  return wabas.size === 1 ? usable[0] : null;
}

export async function fetchWabaDatasetId(
  wabaId: string,
  accessToken: string,
  graphVersion: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true; datasetId: string } | { ok: false; detail: unknown }> {
  const url = `https://graph.facebook.com/${graphVersion}/${wabaId}/dataset?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetchFn(url, { method: "POST" });
  const body = await res.json().catch(() => ({})) as { id?: unknown; error?: unknown };
  const datasetId = digits(body.id);
  if (!res.ok || !datasetId) return { ok: false, detail: body };
  return { ok: true, datasetId };
}

export async function resolveCtwaDestination(
  admin: SupabaseClient,
  organizationId: string,
  ctwaClid: string,
  graphVersion: string,
  fetchFn: typeof fetch = fetch,
): Promise<CtwaDestinationResult> {
  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("phone_number_id")
    .eq("organization_id", organizationId)
    .eq("ctwa_clid", ctwaClid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const phoneNumberId = conv?.phone_number_id != null ? String(conv.phone_number_id).trim() || null : null;

  const { data: rows, error } = await admin
    .from("organization_whatsapp_accounts")
    .select("whatsapp_business_account_id, phone_number_id, meta_access_token, capi_dataset_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (error) return { ok: false, reason: "whatsapp_account_lookup_failed", detail: error.message };

  const account = pickCtwaAccount((rows ?? []) as AccountRow[], phoneNumberId);
  if (!account) return { ok: false, reason: "whatsapp_account_not_connected" };

  const wabaId = digits(account.whatsapp_business_account_id);
  const accessToken = String(account.meta_access_token).trim();
  let datasetId = digits(account.capi_dataset_id);

  if (!datasetId) {
    const created = await fetchWabaDatasetId(wabaId, accessToken, graphVersion, fetchFn);
    if (created.ok === false) return { ok: false, reason: "whatsapp_dataset_unavailable", detail: created.detail };
    datasetId = created.datasetId;
    await admin
      .from("organization_whatsapp_accounts")
      .update({ capi_dataset_id: datasetId })
      .eq("organization_id", organizationId)
      .eq("whatsapp_business_account_id", account.whatsapp_business_account_id);
  }

  return { ok: true, destination: { wabaId, accessToken, datasetId } };
}
