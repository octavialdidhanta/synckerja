/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_API_BASE = "https://graph.facebook.com/v18.0";

const MAX_BYTES: Record<string, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  DOCUMENT: 16 * 1024 * 1024,
};

const MIME_BY_FORMAT: Record<string, readonly string[]> = {
  IMAGE: ["image/jpeg", "image/jpg", "image/png"],
  VIDEO: ["video/mp4"],
  DOCUMENT: ["application/pdf"],
};

function normalizeMime(mime: string): string {
  const m = mime.trim().toLowerCase();
  return m === "image/jpg" ? "image/jpeg" : m;
}

function mimeFromFileName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return null;
}

function allowedMimeForFormat(format: string, mime: string): boolean {
  const list = MIME_BY_FORMAT[format];
  if (!list) return false;
  const n = normalizeMime(mime);
  return list.some((x) => normalizeMime(x) === n);
}

async function resolveUploadContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  activeOrgId: string | null,
  whatsappAccountId: string | null,
): Promise<{ accessToken: string } | null> {
  if (!activeOrgId) return null;
  const accId = (whatsappAccountId ?? "").trim();
  if (accId) {
    const { data: row } = await supabaseAdmin
      .from("organization_whatsapp_accounts")
      .select("meta_access_token")
      .eq("organization_id", activeOrgId)
      .eq("id", accId)
      .maybeSingle();
    let accessToken = (row?.meta_access_token ?? "").toString().trim();
    if (!accessToken) {
      const { data: metaOnly } = await supabaseAdmin
        .from("organization_meta_config")
        .select("meta_access_token")
        .eq("organization_id", activeOrgId)
        .maybeSingle();
      accessToken = (metaOnly?.meta_access_token ?? "").toString().trim();
    }
    if (!accessToken) return null;
    return { accessToken };
  }
  const { data: meta } = await supabaseAdmin
    .from("organization_meta_config")
    .select("meta_access_token")
    .eq("organization_id", activeOrgId)
    .maybeSingle();
  const { data: accRow } = await supabaseAdmin
    .from("organization_whatsapp_accounts")
    .select("meta_access_token")
    .eq("organization_id", activeOrgId)
    .or("is_active.eq.true,is_active.is.null")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let accessToken = (meta?.meta_access_token ?? "").toString().trim();
  if (!accessToken) accessToken = (accRow?.meta_access_token ?? "").toString().trim();
  if (!accessToken) return null;
  return { accessToken };
}

/** Resumable upload session for WhatsApp template headers is created on the Meta *App* node, not the phone number node. */
function uploadsParentGraphId(): { id: string; source: "META_APP_ID" | "PHONE_NUMBER_ID" } | null {
  const appId = (Deno.env.get("META_APP_ID") ?? "").trim();
  if (appId) return { id: appId, source: "META_APP_ID" };
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.active_organization_id ?? null;

    const parent = uploadsParentGraphId();
    if (!parent) {
      return new Response(
        JSON.stringify({
          error:
            "Set Supabase secret META_APP_ID (numeric Meta App ID from developers.facebook.com). Template header upload uses POST /{app-id}/uploads — Phone Number ID is for messaging, not this upload session.",
          code: "MISSING_META_APP_ID",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ct = req.headers.get("Content-Type") ?? "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data with field \"file\"", code: "BAD_CONTENT" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    const formatRaw = form.get("format");
    const format = formatRaw != null ? String(formatRaw).trim().toUpperCase() : "";
    const waAccRaw = form.get("whatsapp_account_id");
    const waAcc = waAccRaw != null ? String(waAccRaw).trim() : "";

    const ctx = await resolveUploadContext(supabaseAdmin, orgId, waAcc || null);
    if (!ctx) {
      return new Response(
        JSON.stringify({
          error:
            waAcc
              ? "WhatsApp account not found for this organization, or missing token. Pick another account or reconnect in Operations → Consultant."
              : "WhatsApp token not configured. Connect WhatsApp (meta_access_token) in Operations → Consultant.",
          code: "WHATSAPP_UPLOAD_NOT_CONFIGURED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty file", code: "MISSING_FILE" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
      return new Response(JSON.stringify({ error: "Invalid format (IMAGE, VIDEO, DOCUMENT)", code: "INVALID_FORMAT" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = (file.name || `sample.${format === "IMAGE" ? "jpg" : format === "VIDEO" ? "mp4" : "pdf"}`).slice(0, 200);
    const rawMime = (file.type || "").trim();
    const mime = normalizeMime(rawMime || mimeFromFileName(fileName) || "application/octet-stream");
    if (!allowedMimeForFormat(format, mime)) {
      return new Response(
        JSON.stringify({
          error: `File type ${mime} not allowed for ${format}. Allowed: ${[...MIME_BY_FORMAT[format]].join(", ")}`,
          code: "INVALID_MIME",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const max = MAX_BYTES[format] ?? 5 * 1024 * 1024;
    if (file.size > max) {
      return new Response(JSON.stringify({ error: `File too large (max ${max} bytes for ${format})`, code: "FILE_TOO_LARGE" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileType = mime;

    const sessionUrl = `${META_API_BASE}/${encodeURIComponent(parent.id)}/uploads`;
    const sessionRes = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_length: file.size,
        file_type: fileType,
        file_name: fileName,
      }),
    });
    const sessionJson = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok) {
      const msg = sessionJson?.error?.message ?? sessionJson?.error_message ?? "Meta upload session failed";
      return new Response(JSON.stringify({ error: String(msg), details: sessionJson, code: "META_SESSION" }), {
        status: sessionRes.status >= 400 && sessionRes.status < 600 ? sessionRes.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uploadSessionId = sessionJson?.id != null ? String(sessionJson.id).trim() : "";
    if (!uploadSessionId) {
      return new Response(JSON.stringify({ error: "Meta did not return upload session id", details: sessionJson, code: "NO_SESSION" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const binaryUrl = `${META_API_BASE}/${uploadSessionId}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    let uploadRes = await fetch(binaryUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/octet-stream",
        file_offset: "0",
      },
      body: bytes,
    });
    let uploadJson = await uploadRes.json().catch(() => ({}));

    if (!uploadRes.ok) {
      const formBody = new FormData();
      formBody.append("file", new Blob([bytes], { type: fileType }), fileName);
      uploadRes = await fetch(binaryUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.accessToken}`,
          file_offset: "0",
        },
        body: formBody,
      });
      uploadJson = await uploadRes.json().catch(() => ({}));
    }

    if (!uploadRes.ok) {
      const msg = uploadJson?.error?.message ?? uploadJson?.error_message ?? "Meta file upload failed";
      return new Response(JSON.stringify({ error: String(msg), details: uploadJson, code: "META_UPLOAD" }), {
        status: uploadRes.status >= 400 && uploadRes.status < 600 ? uploadRes.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const handle = uploadJson?.h != null ? String(uploadJson.h).trim() : "";
    if (!handle) {
      return new Response(JSON.stringify({ error: "Meta did not return handle (h)", details: uploadJson, code: "NO_HANDLE" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ header_handle: handle, format, uploads_parent: parent.source }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg, code: "INTERNAL" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
