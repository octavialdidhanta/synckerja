// Database side of WhatsApp Coexistence webhooks. Messages from the business app
// (echoes) and imported history are stored like other livechat messages, but they
// never create leads, trigger automation flows, or send push notifications.
import {
  type CoexMessageRow,
  type ContactSync,
  digitsOnly,
  freshRows,
  type HistoryChunk,
  historyStatus,
  type PartnerRemoved,
  threadSummary,
} from "./parse.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

const ID_CHUNK = 200;

/** Active Synckerja accounts for this number, narrowed to the WABA when Meta sends one. */
export async function resolveCoexOrgIds(
  supabase: Db,
  phoneNumberId: string,
  wabaId: string | null,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_whatsapp_accounts")
    .select("organization_id, whatsapp_business_account_id")
    .eq("phone_number_id", phoneNumberId)
    .eq("is_active", true);
  if (error || !Array.isArray(data)) return [];
  let rows = data as Array<{ organization_id: string; whatsapp_business_account_id: string | null }>;
  if (wabaId) {
    const matched = rows.filter((r) => (r.whatsapp_business_account_id ?? "").trim() === wabaId);
    const blank = rows.filter((r) => !(r.whatsapp_business_account_id ?? "").trim());
    rows = matched.length > 0 ? matched : blank;
  }
  return [...new Set(rows.map((r) => r.organization_id).filter(Boolean))];
}

async function existingWaIds(supabase: Db, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("wa_message_id")
      .in("wa_message_id", ids.slice(i, i + ID_CHUNK));
    for (const row of (data ?? []) as Array<{ wa_message_id?: string | null }>) {
      if (row.wa_message_id) found.add(row.wa_message_id);
    }
  }
  return found;
}

function later(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!b) return false;
  if (!a) return true;
  return Date.parse(b) > Date.parse(a);
}

function earlier(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!b) return false;
  if (!a) return true;
  return Date.parse(b) < Date.parse(a);
}

/**
 * Store coexistence messages for one organization and number. Rows already saved
 * (same wa_message_id) are skipped, so history overlapping live webhooks is safe.
 */
export async function storeCoexMessages(
  supabase: Db,
  orgId: string,
  phoneNumberId: string,
  rows: CoexMessageRow[],
): Promise<{ inserted: number; conversations: number }> {
  if (rows.length === 0) return { inserted: 0, conversations: 0 };
  const known = await existingWaIds(supabase, [...new Set(rows.map((r) => r.waMessageId))]);
  const fresh = freshRows(rows, known);
  if (fresh.length === 0) return { inserted: 0, conversations: 0 };

  const byCustomer = new Map<string, CoexMessageRow[]>();
  for (const row of fresh) {
    const list = byCustomer.get(row.customerWaId) ?? [];
    list.push(row);
    byCustomer.set(row.customerWaId, list);
  }

  let inserted = 0;
  let conversations = 0;
  for (const [customerWaId, customerRows] of byCustomer) {
    const summary = threadSummary(customerRows);
    if (!summary) continue;

    const { data: existing } = await supabase
      .from("whatsapp_conversations")
      .select("id, last_message_at, last_inbound_at, first_inbound_at")
      .eq("organization_id", orgId)
      .eq("customer_wa_id", customerWaId)
      .eq("channel", "whatsapp")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    let convId: string | null = null;
    if (existing?.id) {
      convId = existing.id as string;
      const patch: Record<string, unknown> = {};
      if (later(existing.last_message_at, summary.lastAt)) {
        patch.last_message_at = summary.lastAt;
        patch.last_message_body = summary.lastBody;
      }
      if (later(existing.last_inbound_at, summary.lastInboundAt)) patch.last_inbound_at = summary.lastInboundAt;
      if (earlier(existing.first_inbound_at, summary.firstInboundAt)) patch.first_inbound_at = summary.firstInboundAt;
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        await supabase.from("whatsapp_conversations").update(patch).eq("id", convId);
      }
    } else {
      const { data: created, error } = await supabase
        .from("whatsapp_conversations")
        .insert({
          organization_id: orgId,
          customer_wa_id: customerWaId,
          customer_external_id: customerWaId,
          channel: "whatsapp",
          phone_number_id: phoneNumberId,
          last_message_at: summary.lastAt,
          last_message_body: summary.lastBody,
          last_inbound_at: summary.lastInboundAt,
          first_inbound_at: summary.firstInboundAt,
          updated_at: summary.lastAt,
        })
        .select("id")
        .single();
      if (error || !created?.id) {
        console.error("[whatsapp-coexistence] conversation insert failed", { orgId, code: error?.code ?? "" });
        continue;
      }
      convId = created.id as string;
      conversations += 1;
    }

    const payload = customerRows.map((row) => {
      const base: Record<string, unknown> = {
        conversation_id: convId,
        direction: row.direction,
        wa_message_id: row.waMessageId,
        platform_message_id: row.waMessageId,
        channel: "whatsapp",
        body: row.body,
        message_type: row.messageType,
        raw_metadata: row.raw,
        created_at: row.createdAt,
      };
      // Replies typed in the WhatsApp Business app on the phone. Inbound rows keep the column default.
      if (row.direction === "outbound") base.source = "business_app";
      return base;
    });
    const { error: insertError } = await supabase.from("whatsapp_messages").insert(payload);
    if (insertError) {
      console.error("[whatsapp-coexistence] message insert failed", { orgId, count: payload.length, code: insertError.code ?? "" });
      continue;
    }
    inserted += payload.length;
  }
  return { inserted, conversations };
}

/** Record history sync progress on the account row so the integrations page can show it. */
export async function recordHistoryProgress(
  supabase: Db,
  phoneNumberId: string,
  chunk: HistoryChunk,
): Promise<void> {
  const status = historyStatus(chunk);
  const patch: Record<string, unknown> = {
    history_sync_status: status,
    updated_at: new Date().toISOString(),
  };
  if (chunk.progress != null && chunk.phase != null) {
    // Three phases (0–1 day, 1–90 days, 90–180 days); show one 0–100 number.
    patch.history_sync_progress = Math.min(100, Math.round((chunk.phase * 100 + chunk.progress) / 3));
  }
  if (status === "done") patch.history_sync_progress = 100;
  if (chunk.declined) {
    patch.history_sync_error = chunk.declined.message ?? `declined (${chunk.declined.code ?? "unknown"})`;
  }
  await supabase.from("organization_whatsapp_accounts").update(patch).eq("phone_number_id", phoneNumberId).eq("is_active", true);
}

/** Use contact names saved in the phone as the conversation's customer name. */
export async function applyContactNames(
  supabase: Db,
  orgIds: string[],
  phoneNumberId: string,
  contacts: ContactSync[],
): Promise<number> {
  let updated = 0;
  for (const contact of contacts) {
    if (contact.action !== "add" || !contact.fullName) continue;
    const { data } = await supabase
      .from("whatsapp_conversations")
      .update({ customer_name: contact.fullName, updated_at: new Date().toISOString() })
      .in("organization_id", orgIds)
      .eq("phone_number_id", phoneNumberId)
      .eq("customer_wa_id", contact.phoneDigits)
      .select("id");
    updated += Array.isArray(data) ? data.length : 0;
  }
  return updated;
}

/** PARTNER_REMOVED: the business disconnected the number from Synckerja (or Meta did). */
export async function deactivateOnPartnerRemoved(
  supabase: Db,
  wabaId: string,
  removed: PartnerRemoved,
): Promise<number> {
  const { data } = await supabase
    .from("organization_whatsapp_accounts")
    .select("id, display_phone_number")
    .eq("whatsapp_business_account_id", wabaId)
    .eq("is_active", true);
  const rows = ((data ?? []) as Array<{ id: string; display_phone_number: string | null }>).filter((row) =>
    !removed.phoneDigits || digitsOnly(row.display_phone_number) === removed.phoneDigits
  );
  for (const row of rows) {
    await supabase
      .from("organization_whatsapp_accounts")
      .update({
        is_active: false,
        disconnected_reason: [removed.reason, removed.initiatedBy].filter(Boolean).join(" / ") || "PARTNER_REMOVED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
  return rows.length;
}
