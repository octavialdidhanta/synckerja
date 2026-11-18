import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Reply preview for an outbound Messenger / Instagram reply: the text (or media type) of the quoted message,
// stored on the new row so the chat shows the quote after a reload. Mirrors the inbound webhook logic.

const MEDIA_TYPES = ["image", "video", "file", "audio"];

export type ReplyContext = { reply_to_body: string; reply_to_message_type: string | null };

export function replyPreviewFromRow(row: { body?: unknown; message_type?: unknown } | null): ReplyContext {
  if (!row) return { reply_to_body: "[Pesan]", reply_to_message_type: null };
  const type = String(row.message_type ?? "text") || "text";
  const body = row.body != null ? String(row.body) : "";
  if (body !== "") return { reply_to_body: body.slice(0, 500), reply_to_message_type: type };
  return {
    reply_to_body: MEDIA_TYPES.includes(type.toLowerCase()) ? `[${type}]` : "[Pesan]",
    reply_to_message_type: type,
  };
}

export async function loadReplyContext(
  client: SupabaseClient,
  table: "facebook_messages" | "instagram_messages",
  conversationId: string,
  replyToMid: string,
): Promise<ReplyContext> {
  try {
    const { data } = await client
      .from(table)
      .select("body, message_type")
      .eq("conversation_id", conversationId)
      .eq("platform_message_id", replyToMid)
      .maybeSingle();
    return replyPreviewFromRow(data ?? null);
  } catch {
    return replyPreviewFromRow(null);
  }
}
