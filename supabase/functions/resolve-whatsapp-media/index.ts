import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_GRAPH_BASE = "https://graph.facebook.com/v18.0";
/** Same bucket as outbound sends (ChatThread) – satu bucket untuk kirim & terima media */
const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";

function getMediaIdAndType(msg: Record<string, unknown>): { id: string; type: string; mime?: string; filename?: string } | null {
  const img = msg.image as { id?: string; mime_type?: string } | undefined;
  if (img?.id) return { id: img.id, type: "image", mime: img.mime_type };
  const vid = msg.video as { id?: string; mime_type?: string } | undefined;
  if (vid?.id) return { id: vid.id, type: "video", mime: vid.mime_type };
  const doc = msg.document as { id?: string; mime_type?: string; filename?: string } | undefined;
  if (doc?.id) return { id: doc.id, type: "document", mime: doc.mime_type, filename: doc.filename };
  const aud = msg.audio as { id?: string; mime_type?: string } | undefined;
  if (aud?.id) return { id: aud.id, type: "audio", mime: aud.mime_type };
  return null;
}

function extensionFromMimeOrFilename(mime?: string, filename?: string): string {
  if (filename && filename.includes(".")) return filename.replace(/^.*\./, "").toLowerCase().slice(0, 8);
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/amr": "amr",
  };
  if (mime) return map[mime.toLowerCase()] ?? mime.split("/")[1]?.slice(0, 8) ?? "bin";
  return "bin";
}

async function resolveMediaUrl(
  mediaId: string,
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  waMessageId: string,
  mime?: string,
  filename?: string
): Promise<{ url: string | null; error?: string }> {
  try {
    const metaRes = await fetch(`${META_GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      const metaJson = await metaRes.json().catch(() => ({}));
      const msg = metaJson?.error?.message ?? metaRes.statusText;
      return { url: null, error: `Meta API: ${msg} (media mungkin kedaluwarsa)` };
    }
    const metaJson = await metaRes.json().catch(() => ({}));
    const downloadUrl = metaJson.url;
    if (!downloadUrl || typeof downloadUrl !== "string") {
      return { url: null, error: "Meta tidak mengembalikan URL unduh" };
    }

    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) {
      return { url: null, error: `Unduh dari Meta gagal (${fileRes.status}). URL mungkin kedaluwarsa.` };
    }
    const blob = await fileRes.blob();
    const ext = extensionFromMimeOrFilename(mime, filename);
    const safeId = waMessageId.replace(/\W/g, "_");
    const path = `inbound/${conversationId}/${safeId}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });
    if (uploadErr) {
      return { url: null, error: `Upload storage gagal: ${uploadErr.message}` };
    }
    const { data: urlData } = supabase.storage.from(WHATSAPP_MEDIA_BUCKET).getPublicUrl(path);
    return { url: urlData.publicUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { url: null, error: msg };
  }
}

/** Always 200 + JSON so gateway never sees 4xx/5xx (avoids 502). Client reads body.error / body.media_url. */
function ok(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...corsHeaders, "Content-Length": "2" } });
  }

  try {
    if (req.method !== "POST") {
      return ok({ error: "Method not allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("resolve-whatsapp-media: missing env");
      return ok({ media_url: null, error: "Server configuration error" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return ok({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user ?? null;
    if (userError || !user) {
      return ok({ error: "Invalid token" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();
    const orgId = profile?.active_organization_id ?? null;
    if (!orgId) {
      return ok({ error: "No active organization" });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // ignore invalid JSON
    }
    const messageId = body?.message_id ?? body?.messageId;
    if (!messageId || typeof messageId !== "string") {
      return ok({ error: "Missing message_id" });
    }

    const { data: message, error: msgError } = await supabase
      .from("whatsapp_messages")
      .select("id, conversation_id, direction, message_type, media_url, wa_message_id, raw_metadata")
      .eq("id", messageId)
      .single();

    if (msgError || !message) {
      return ok({ error: "Message not found" });
    }

    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("organization_id, phone_number_id")
      .eq("id", message.conversation_id)
      .single();

    if (!conv || conv.organization_id !== orgId) {
      return ok({ error: "Access denied" });
    }

    if (message.direction !== "inbound") {
      return ok({ error: "Only inbound media can be resolved" });
    }
    if (message.media_url) {
      return ok({ media_url: message.media_url });
    }
    const allowedTypes = ["image", "video", "document", "audio"];
    if (!allowedTypes.includes(message.message_type ?? "")) {
      return ok({ error: "Message is not media type" });
    }

    const raw = (message.raw_metadata ?? {}) as Record<string, unknown>;
    const mediaInfo = getMediaIdAndType(raw);
    if (!mediaInfo) {
      return ok({ error: "No media id in message" });
    }

    let accessToken: string | null = null;
    if (conv.phone_number_id) {
      const { data: accountRow } = await supabase
        .from("organization_whatsapp_accounts")
        .select("meta_access_token")
        .eq("organization_id", orgId)
        .eq("phone_number_id", conv.phone_number_id)
        .eq("is_active", true)
        .maybeSingle();
      accessToken = (accountRow?.meta_access_token ?? "").trim() || null;
    }
    if (!accessToken) {
      const { data: orgMeta } = await supabase
        .from("organization_meta_config")
        .select("meta_access_token")
        .eq("organization_id", orgId)
        .maybeSingle();
      accessToken = (orgMeta?.meta_access_token ?? "").trim() || null;
    }
    if (!accessToken) {
      return ok({ error: "WhatsApp not configured" });
    }

    const result = await resolveMediaUrl(
      mediaInfo.id,
      accessToken,
      supabase,
      message.conversation_id,
      (message.wa_message_id ?? message.id) as string,
      mediaInfo.mime,
      mediaInfo.filename
    );

    if (!result.url) {
      return ok({ media_url: null, error: result.error ?? "Failed to resolve media (expired or unavailable)" });
    }

    const { error: updateError } = await supabase
      .from("whatsapp_messages")
      .update({ media_url: result.url })
      .eq("id", messageId);

    if (updateError) {
      console.error("resolve-whatsapp-media DB update error:", updateError);
      return ok({ media_url: null, error: "Media berhasil diunduh tetapi gagal menyimpan ke database. Coba lagi." });
    }

    return ok({ media_url: result.url });
  } catch (err) {
    console.error("resolve-whatsapp-media unhandled:", err);
    return new Response('{"media_url":null,"error":"Resolve failed"}', {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
