/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MEDIA_BUCKET = "whatsapp-media";

function extensionFromMediaType(mediaType: string, mime?: string): string {
  const map: Record<string, string> = { image: "jpg", video: "mp4", audio: "mp3", file: "bin" };
  const t = mediaType.trim().toLowerCase();
  if (mime) {
    const m = mime.toLowerCase();
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    if (m.includes("png")) return "png";
    if (m.includes("mp4")) return "mp4";
  }
  return map[t] ?? "bin";
}

function getAttachmentFromRaw(raw: Record<string, unknown>): { type: string; url: string } | null {
  const msg = raw.message as Record<string, unknown> | undefined;
  if (!msg) return null;
  const attachments = msg.attachments as Array<{ type?: string; payload?: { url?: string } }> | undefined;
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const first = attachments[0];
  const url = typeof first?.payload?.url === "string" ? first.payload.url.trim() : "";
  const type = typeof first?.type === "string" ? first.type.trim().toLowerCase() : "file";
  if (!url) return null;
  return { type, url };
}

async function downloadToStorage(
  downloadUrl: string,
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  platformMessageId: string,
  mediaType: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) {
      return { url: null, error: `Download failed (${fileRes.status}). URL may have expired.` };
    }
    const blob = await fileRes.blob();
    const ext = extensionFromMediaType(mediaType, blob.type);
    const safeId = platformMessageId.replace(/\W/g, "_");
    const path = `fb/inbound/${conversationId}/${safeId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });
    if (uploadErr) return { url: null, error: `Upload failed: ${uploadErr.message}` };
    const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return { url: urlData.publicUrl };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) };
  }
}

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
    if (req.method !== "POST") return ok({ error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return ok({ media_url: null, error: "Server configuration error" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return ok({ error: "Unauthorized" });

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return ok({ error: "Invalid token" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userData.user.id)
      .single();
    const orgId = profile?.active_organization_id ?? null;
    if (!orgId) return ok({ error: "No active organization" });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const messageId = body?.message_id ?? body?.messageId;
    if (!messageId || typeof messageId !== "string") return ok({ error: "Missing message_id" });

    const { data: message, error: msgError } = await supabase
      .from("facebook_messages")
      .select("id, conversation_id, direction, message_type, media_url, platform_message_id, raw_metadata")
      .eq("id", messageId)
      .single();

    if (msgError || !message) return ok({ error: "Message not found" });

    const { data: conv } = await supabase
      .from("facebook_conversations")
      .select("organization_id, facebook_page_id")
      .eq("id", message.conversation_id)
      .single();

    if (!conv || conv.organization_id !== orgId) return ok({ error: "Access denied" });
    if (message.direction !== "inbound") return ok({ error: "Only inbound media can be resolved" });
    if (message.media_url) return ok({ media_url: message.media_url });

    const allowedTypes = ["image", "video", "audio", "file"];
    if (!allowedTypes.includes(message.message_type ?? "")) {
      return ok({ error: "Message is not media type" });
    }

    const raw = (message.raw_metadata ?? {}) as Record<string, unknown>;
    const attachment = getAttachmentFromRaw(raw);
    if (!attachment) return ok({ error: "No attachment URL in message metadata" });

    const { data: fbPage } = await supabase
      .from("organization_facebook_pages")
      .select("page_access_token")
      .eq("organization_id", orgId)
      .eq("facebook_page_id", conv.facebook_page_id)
      .eq("is_active", true)
      .maybeSingle();

    const accessToken = (fbPage?.page_access_token ?? "").trim();
    if (!accessToken) return ok({ error: "Facebook Page not configured" });

    const platformMid = (message.platform_message_id ?? message.id) as string;
    const result = await downloadToStorage(
      attachment.url,
      accessToken,
      supabase,
      message.conversation_id,
      platformMid,
      attachment.type || (message.message_type as string),
    );

    if (!result.url) {
      return ok({ media_url: null, error: result.error ?? "Failed to resolve media" });
    }

    const { error: updateError } = await supabase
      .from("facebook_messages")
      .update({ media_url: result.url })
      .eq("id", messageId);

    if (updateError) {
      return ok({ media_url: null, error: "Media downloaded but failed to save to database" });
    }

    return ok({ media_url: result.url });
  } catch (err) {
    console.error("resolve-facebook-media unhandled:", err);
    return ok({ media_url: null, error: "Resolve failed" });
  }
});
