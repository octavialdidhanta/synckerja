/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runLeadMagnetRuntime } from "../_shared/leadMagnet/runLeadMagnetRuntime.ts";
import { handleLeadMagnetPostbackTrigger } from "../_shared/leadMagnet/postbackHandler.ts";
import { resolveLeadMagnetEntitlement } from "../_shared/leadMagnet/leadMagnetEntitlement.ts";
import {
  buildLeadMagnetPostbackPayload,
  type FollowConfirmResult,
  type LeadMagnetRuntimeInput,
} from "../_shared/leadMagnet/types.ts";
import {
  verifyLeadMagnetActionUrl,
  type LeadMagnetAction,
} from "../_shared/leadMagnet/leadMagnetActionUrl.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ActionResponseBody = {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  pageUrl?: string | null;
};

function wantsHtml(req: Request): boolean {
  const accept = (req.headers.get("Accept") ?? "").toLowerCase();
  return accept.includes("text/html") && !accept.includes("application/json");
}

function actionResponse(req: Request, body: ActionResponseBody, status = 200): Response {
  if (wantsHtml(req)) {
    const pageLink = body.pageUrl
      ? `<p style="margin-top:1rem"><a href="${body.pageUrl}" style="color:#2563eb">Buka Page Facebook</a></p>`
      : "";
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>${body.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6; color: #111827; }
    .card { max-width: 22rem; padding: 1.5rem; border-radius: 0.75rem; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); text-align: center; }
    h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
    p { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: #4b5563; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${body.title}</h1>
    <p>${body.message}</p>
    ${pageLink}
  </div>
</body>
</html>`;
    return new Response(html, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

function mapFollowConfirmResult(
  result: FollowConfirmResult,
  pageUrl: string | null,
): ActionResponseBody {
  if (result.outcome === "blocked" && result.reason === "fb_first_confirm") {
    return {
      ok: true,
      code: "fb_first_confirm",
      title: "Ikuti Page dulu",
      message: "Ikuti Page Facebook terlebih dahulu, lalu kembali ke Messenger dan klik Sudah Follow lagi.",
      pageUrl,
    };
  }
  if (result.outcome === "blocked" && result.reason === "ig_not_following") {
    return {
      ok: true,
      code: "ig_not_following",
      title: "Belum follow",
      message: "Akun Instagram belum follow. Follow dulu, lalu klik Sudah Follow lagi di DM.",
      pageUrl: null,
    };
  }
  if (result.outcome === "already_processed") {
    return {
      ok: true,
      code: "already_processed",
      title: "Sudah diproses",
      message: "Permintaan sudah pernah diproses. Cek Messenger Anda.",
      pageUrl: null,
    };
  }
  return {
    ok: true,
    code: "material_sent",
    title: "Terima kasih!",
    message: "Cek Messenger — pesan materi akan segera dikirim.",
    pageUrl: null,
  };
}

async function resolvePageCredentials(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  accountId: string,
): Promise<{ pageId: string; accessToken: string; pageUrl: string | null } | null> {
  const { data: fbPage } = await admin
    .from("organization_facebook_pages")
    .select("facebook_page_id, page_access_token, page_name")
    .eq("organization_id", organizationId)
    .eq("facebook_page_id", accountId)
    .eq("is_active", true)
    .maybeSingle();
  const fbToken = (fbPage?.page_access_token as string | null)?.trim() ?? "";
  if (fbPage?.facebook_page_id && fbToken) {
    const pageId = String(fbPage.facebook_page_id).trim();
    return {
      pageId,
      accessToken: fbToken,
      pageUrl: `https://www.facebook.com/${encodeURIComponent(pageId)}`,
    };
  }

  const { data: igRow } = await admin
    .from("organization_instagram_accounts")
    .select("facebook_page_id, page_access_token")
    .eq("organization_id", organizationId)
    .eq("instagram_business_account_id", accountId)
    .eq("is_active", true)
    .maybeSingle();
  const igToken = (igRow?.page_access_token as string | null)?.trim() ?? "";
  const pageId = (igRow?.facebook_page_id as string | null)?.trim() ?? "";
  if (pageId && igToken) {
    return {
      pageId,
      accessToken: igToken,
      pageUrl: `https://www.facebook.com/${encodeURIComponent(pageId)}`,
    };
  }

  return null;
}

async function handleActionGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const enrollmentId = (url.searchParams.get("e") ?? "").trim();
  const action = (url.searchParams.get("a") ?? "").trim() as LeadMagnetAction;
  const expiry = (url.searchParams.get("t") ?? "").trim();
  const sig = (url.searchParams.get("s") ?? "").trim();

  if (!enrollmentId || !action || !expiry || !sig) {
    return actionResponse(req, {
      ok: false,
      code: "invalid_params",
      title: "Link tidak valid",
      message: "Parameter tautan tidak lengkap.",
    }, 400);
  }

  const valid = await verifyLeadMagnetActionUrl(enrollmentId, action, expiry, sig);
  if (!valid) {
    return actionResponse(req, {
      ok: false,
      code: "expired",
      title: "Link kedaluwarsa",
      message: "Silakan kembali ke Messenger dan minta link baru.",
    }, 400);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: enrollment, error } = await admin
    .from("lead_magnet_enrollments")
    .select("*, campaign:lead_magnet_campaigns(*)")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error || !enrollment) {
    return actionResponse(req, {
      ok: false,
      code: "not_found",
      title: "Tidak ditemukan",
      message: "Enrollment tidak ditemukan.",
    }, 404);
  }

  const campaignRaw = (enrollment as { campaign?: unknown }).campaign;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  if (!campaign) {
    return actionResponse(req, {
      ok: false,
      code: "campaign_missing",
      title: "Kampanye tidak ditemukan",
      message: "Data kampanye tidak tersedia.",
    }, 404);
  }

  const orgId = String(enrollment.organization_id);
  const accountId = String(campaign.account_id);
  const creds = await resolvePageCredentials(admin, orgId, accountId);
  if (!creds) {
    return actionResponse(req, {
      ok: false,
      code: "page_credentials",
      title: "Koneksi Page bermasalah",
      message: "Token Page tidak ditemukan. Hubungi admin.",
    }, 503);
  }

  const entitlement = await resolveLeadMagnetEntitlement(admin, orgId);
  if (!entitlement.entitled) {
    return actionResponse(req, {
      ok: false,
      code: "not_entitled",
      title: "Tidak tersedia",
      message: "Fitur Lead Magnet tidak aktif untuk organisasi ini.",
    }, 403);
  }

  if (action === "follow_confirm" && enrollment.status !== "follow_gate_sent") {
    return actionResponse(req, {
      ok: true,
      code: "already_processed",
      title: "Sudah diproses",
      message: "Permintaan sudah pernah diproses. Cek Messenger Anda.",
    });
  }

  if (action === "get_framework" && enrollment.status === "delivered") {
    return actionResponse(req, {
      ok: true,
      code: "already_processed",
      title: "Sudah diproses",
      message: "Materi sudah pernah dikirim. Cek Messenger Anda.",
    });
  }

  const payload = buildLeadMagnetPostbackPayload(enrollmentId, action);
  const input: LeadMagnetRuntimeInput = {
    trigger: "postback",
    platform: enrollment.platform as "instagram" | "facebook",
    organizationId: orgId,
    accountId,
    participantScopedId: String(enrollment.participant_scoped_id),
    participantUsername: (enrollment.participant_username as string | null) ?? null,
    payload,
    conversationId: (enrollment.conversation_id as string | null) ?? null,
    accessToken: creds.accessToken,
    pageId: creds.pageId,
  };

  const result = await handleLeadMagnetPostbackTrigger(admin, input);

  if (action === "follow_confirm") {
    if (result.followConfirm) {
      return actionResponse(req, mapFollowConfirmResult(result.followConfirm, creds.pageUrl));
    }
    return actionResponse(req, {
      ok: result.handled,
      code: result.handled ? "processed" : "failed",
      title: result.handled ? "Terima kasih!" : "Gagal",
      message: result.handled
        ? "Cek Messenger — pesan materi akan segera dikirim."
        : "Permintaan tidak dapat diproses.",
    });
  }

  return actionResponse(req, {
    ok: result.handled,
    code: result.handled ? "delivery_sent" : "failed",
    title: result.handled ? "Materi dikirim!" : "Gagal",
    message: result.handled
      ? "Cek Messenger untuk link materi."
      : "Permintaan tidak dapat diproses.",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const pathname = new URL(req.url).pathname;
  if (req.method === "GET" && pathname.endsWith("/action")) {
    return handleActionGet(req);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: LeadMagnetRuntimeInput;
  try {
    body = await req.json() as LeadMagnetRuntimeInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const handled = await runLeadMagnetRuntime(admin, body);

  return new Response(JSON.stringify({ success: true, handled }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
