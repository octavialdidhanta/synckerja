// Messenger / Instagram "echo" events: copies of messages the business sent.
//
// Meta sends an echo (message.is_echo = true, sender = Page/IG inbox, recipient = customer) for
// every outbound message, including replies typed in the Facebook / Instagram / Business Suite
// apps. Those replies never went through Synckerja, so they must be stored from the echo, the same
// way WhatsApp Coexistence stores smb_message_echoes.
//
// Messages sent from Synckerja also echo back. They are already stored by send-*-message with the
// same platform_message_id, so the echo is skipped (own app_id, or the mid already exists, enforced
// by a unique (conversation_id, platform_message_id) index).
//
// Lead status, assignee and the 24h customer session are NOT changed by an echo: only the
// conversation's last message preview moves forward.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EchoMessage = {
  is_echo?: boolean;
  is_deleted?: boolean;
  mid?: string;
  app_id?: unknown;
  text?: unknown;
  attachments?: unknown[];
};

export type EchoTable = "facebook_messages" | "instagram_messages";
export type EchoConversationTable = "facebook_conversations" | "instagram_conversations";

export type NativeEchoPlan =
  | { store: true; mid: string; body: string; messageType: string }
  | { store: false; reason: "not_echo" | "deleted" | "no_mid" | "no_customer" | "own_app" };

/** Body / type of an echoed message, same labels as inbound ("[image]" for attachments). */
export function echoMessageBody(message: EchoMessage): { body: string; messageType: string } {
  const text = typeof message.text === "string"
    ? message.text
    : (message.text as { text?: string } | undefined)?.text;
  if (text != null && String(text).trim() !== "") return { body: String(text).trim(), messageType: "text" };
  const attachments = message.attachments as Array<{ type?: string }> | undefined;
  if (Array.isArray(attachments) && attachments.length > 0) {
    const t = typeof attachments[0]?.type === "string" && attachments[0].type ? attachments[0].type : "file";
    return { body: `[${t}]`, messageType: t };
  }
  return { body: "[message]", messageType: "text" };
}

/** Pure decision: should this echo be stored as an outbound reply sent from the native app? */
export function planNativeEcho(
  message: EchoMessage | undefined,
  customerId: string | null,
  ownAppId: string | null,
): NativeEchoPlan {
  if (!message || message.is_echo !== true) return { store: false, reason: "not_echo" };
  if (message.is_deleted) return { store: false, reason: "deleted" };
  const mid = typeof message.mid === "string" ? message.mid.trim() : "";
  if (!mid) return { store: false, reason: "no_mid" };
  if (!customerId || !customerId.trim()) return { store: false, reason: "no_customer" };
  const appId = message.app_id != null ? String(message.app_id).trim() : "";
  if (ownAppId && appId && appId === ownAppId.trim()) return { store: false, reason: "own_app" };
  const { body, messageType } = echoMessageBody(message);
  return { store: true, mid, body, messageType };
}

export function ownMetaAppId(): string | null {
  const id = (Deno.env.get("META_APP_ID") ?? "").trim();
  return id || null;
}

/**
 * Insert the echo as an outbound message into each conversation (one per organization that holds
 * this customer thread). Returns how many rows were inserted.
 */
export async function storeNativeEcho(
  supabase: SupabaseClient,
  args: {
    messageTable: EchoTable;
    conversationTable: EchoConversationTable;
    conversationIds: string[];
    plan: Extract<NativeEchoPlan, { store: true }>;
    ts: string;
    rawEvent: unknown;
    channel: "facebook" | "instagram";
  },
): Promise<number> {
  let inserted = 0;
  const unique = [...new Set(args.conversationIds.filter(Boolean))];
  for (const conversationId of unique) {
    const { data: existing } = await supabase
      .from(args.messageTable)
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("platform_message_id", args.plan.mid)
      .maybeSingle();
    if (existing?.id) continue;

    const rawMetadata = args.rawEvent && typeof args.rawEvent === "object"
      ? { ...(args.rawEvent as Record<string, unknown>), synckerja_source: "native_app" }
      : { synckerja_source: "native_app" };

    const { error } = await supabase.from(args.messageTable).insert({
      conversation_id: conversationId,
      direction: "outbound",
      platform_message_id: args.plan.mid,
      body: args.plan.body,
      message_type: args.plan.messageType,
      raw_metadata: rawMetadata,
      status: "sent",
      status_updated_at: args.ts,
      created_at: args.ts,
    });
    if (error) {
      // 23505 = already stored by send-*-message in the meantime (unique conversation + mid).
      if ((error as { code?: string }).code !== "23505") {
        console.error(`[${args.channel}-echo] insert failed`, { conversationId, mid: args.plan.mid, error: error.message });
      }
      continue;
    }
    inserted += 1;

    const { data: conv } = await supabase
      .from(args.conversationTable)
      .select("last_message_at")
      .eq("id", conversationId)
      .maybeSingle();
    const lastAt = (conv as { last_message_at?: string | null } | null)?.last_message_at ?? null;
    if (!lastAt || new Date(lastAt).getTime() <= new Date(args.ts).getTime()) {
      await supabase
        .from(args.conversationTable)
        .update({
          last_message_at: args.ts,
          last_message_body: args.plan.body.slice(0, 200),
          last_message_direction: "outbound",
          last_message_status: "sent",
          updated_at: args.ts,
        })
        .eq("id", conversationId);
    }
  }
  return inserted;
}

/** Messenger: the customer is the echo's recipient (PSID) on this Page, in any connected organization. */
export async function findFacebookEchoConversationIds(
  supabase: SupabaseClient,
  pageId: string,
  customerPsid: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("facebook_conversations")
    .select("id")
    .eq("facebook_page_id", pageId)
    .eq("customer_psid", customerPsid);
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

/** Instagram: the customer is the echo's recipient (IGSID) on this inbox, in any connected organization. */
export async function findInstagramEchoConversationIds(
  supabase: SupabaseClient,
  inboxBusinessAccountId: string,
  customerIds: string[],
): Promise<string[]> {
  const ids = [...new Set(customerIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const list = ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
  const { data } = await supabase
    .from("instagram_conversations")
    .select("id")
    .eq("instagram_business_account_id", inboxBusinessAccountId)
    .or(`customer_ig_id.in.(${list}),customer_external_id.in.(${list})`);
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}
