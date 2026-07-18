/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runLeadMagnetRuntime } from "../_shared/leadMagnet/runLeadMagnetRuntime.ts";
import { handleLeadMagnetPostbackTrigger } from "../_shared/leadMagnet/postbackHandler.ts";
import { resendLeadMagnetDeliveryDm } from "../_shared/leadMagnet/followGateRuntime.ts";
import { runAsyncDelivery } from "../_shared/leadMagnet/delivery/deliveryOrchestrator.ts";
import { resolveLeadMagnetEntitlement } from "../_shared/leadMagnet/leadMagnetEntitlement.ts";
import {
  buildLeadMagnetPostbackPayload,
  type FollowConfirmResult,
  type LeadMagnetRuntimeInput,
} from "../_shared/leadMagnet/types.ts";
import {
  verifyLeadMagnetActionUrl,
  buildSpaRedirectHtml,
  buildDownloadLandingHtml,
  wantsJsonActionApi,
  type LeadMagnetAction,
  type DownloadLandingBody,
} from "../_shared/leadMagnet/leadMagnetActionUrl.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function isAuthorizedServiceCall(req: Request): boolean {
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  if (serviceRoleKey && token === serviceRoleKey) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      role?: string;
      ref?: string;
      iss?: string;
    };
    const projectRef = (Deno.env.get("SUPABASE_URL") ?? "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";
    const roleOk = payload.role === "service_role";
    const refOk = !projectRef || payload.ref === projectRef || (payload.iss ?? "").includes(projectRef);
    return roleOk && refOk;
  } catch {
    return false;
  }
}

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
  if (result.outcome === "dm_failed") {
    return {
      ok: false,
      code: "dm_failed",
      title: "Pesan belum terkirim",
      message: "Messenger menolak pengiriman DM. Kembali ke Messenger, klik tombol Sudah Follow di chat (bukan link browser), lalu coba lagi.",
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

  // Messenger / browser opened edge URL directly (legacy buttons) → redirect to SPA.
  if (!wantsJsonActionApi(req)) {
    const qs = url.searchParams.toString();
    const html = buildSpaRedirectHtml(qs);
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
    });
  }

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

  const dmFlowVersion = Number((enrollment as { dm_flow_version?: number }).dm_flow_version ?? 1);
  const isOpeningFirst = dmFlowVersion === 2;

  if (isOpeningFirst) {
    return actionResponse(req, {
      ok: result.handled,
      code: result.handled ? "next_step_sent" : "failed",
      title: result.handled ? "Langkah berikutnya dikirim!" : "Gagal",
      message: result.handled
        ? "Langkah selanjutnya dikirim ke Messenger. Cek chat Anda."
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

type DownloadResponseBody = DownloadLandingBody;

function downloadFileNameFromUrl(fileUrl: string): string {
  try {
    const name = decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() ?? "");
    return name || "materi";
  } catch {
    return "materi";
  }
}

function downloadHtmlResponse(body: DownloadResponseBody, status = 200): Response {
  return new Response(buildDownloadLandingHtml(body), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
  });
}

async function resolveDownloadBody(
  enrollmentId: string,
  expiry: string,
  sig: string,
  linkIndexRaw?: string | null,
): Promise<{ status: number; body: DownloadResponseBody }> {
  const action: LeadMagnetAction = "download";
  const { parseDownloadLinkIndex, resolveCampaignDeliveryLinks, getDeliveryUrlAtIndex } =
    await import("../_shared/leadMagnet/deliveryLinks.ts");
  const linkIndex = parseDownloadLinkIndex(linkIndexRaw);

  if (!enrollmentId || !expiry || !sig) {
    return {
      status: 400,
      body: {
        ok: false,
        code: "invalid_params",
        title: "Link tidak valid",
        message: "Parameter tautan tidak lengkap.",
      },
    };
  }

  const valid = await verifyLeadMagnetActionUrl(enrollmentId, action, expiry, sig, linkIndex);
  if (!valid) {
    return {
      status: 400,
      body: {
        ok: false,
        code: "expired",
        title: "Link kedaluwarsa",
        message: "Silakan kembali ke Messenger dan minta link baru.",
      },
    };
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
    return {
      status: 404,
      body: {
        ok: false,
        code: "not_found",
        title: "Tidak ditemukan",
        message: "Enrollment tidak ditemukan.",
      },
    };
  }

  const campaignRaw = (enrollment as { campaign?: unknown }).campaign;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  const links = resolveCampaignDeliveryLinks(campaign ?? {});
  const fileUrl = getDeliveryUrlAtIndex(
    links,
    linkIndex,
    campaign?.delivery_url,
  );
  if (!fileUrl) {
    return {
      status: 404,
      body: {
        ok: false,
        code: "file_missing",
        title: "Materi tidak tersedia",
        message: "File materi belum dikonfigurasi untuk kampanye ini.",
      },
    };
  }

  const buttonLabel = links[linkIndex]?.label?.trim()
    || String(campaign?.delivery_button_label ?? "Unduh");

  return {
    status: 200,
    body: {
      ok: true,
      code: "ready",
      title: "Materi siap diunduh",
      message: "Klik tombol di bawah untuk mengunduh file materi Anda.",
      fileUrl,
      buttonLabel,
      fileName: downloadFileNameFromUrl(fileUrl),
    },
  };
}

async function handleDownloadGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const enrollmentId = (url.searchParams.get("e") ?? "").trim();
  const expiry = (url.searchParams.get("t") ?? "").trim();
  const sig = (url.searchParams.get("s") ?? "").trim();
  const linkIndex = url.searchParams.get("i");

  const resolved = await resolveDownloadBody(enrollmentId, expiry, sig, linkIndex);

  if (!wantsJsonActionApi(req)) {
    // Legacy buttons still open Supabase edge URL — redirect to file; gateway serves HTML as text/plain.
    if (resolved.body.ok && resolved.body.fileUrl) {
      return Response.redirect(resolved.body.fileUrl, 302);
    }
    return downloadHtmlResponse(resolved.body, resolved.status);
  }

  return new Response(JSON.stringify(resolved.body), {
    status: resolved.status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
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
  if (req.method === "GET" && pathname.endsWith("/download")) {
    return handleDownloadGet(req);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (req.method === "POST" && pathname.endsWith("/resend-delivery")) {
    if (!isAuthorizedServiceCall(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let payload: { enrollmentId?: string };
    try {
      payload = await req.json() as { enrollmentId?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const enrollmentId = (payload.enrollmentId ?? "").trim();
    if (!enrollmentId) {
      return new Response(JSON.stringify({ error: "Missing enrollmentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: enrollment, error } = await admin
      .from("lead_magnet_enrollments")
      .select("*, campaign:lead_magnet_campaigns(*)")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (error || !enrollment) {
      return new Response(JSON.stringify({ error: "Enrollment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const campaignRaw = (enrollment as { campaign?: unknown }).campaign;
    const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = String(enrollment.organization_id);
    const accountId = String(campaign.account_id);
    const creds = await resolvePageCredentials(admin, orgId, accountId);
    if (!creds) {
      return new Response(JSON.stringify({ error: "Page credentials missing" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await resendLeadMagnetDeliveryDm(admin, {
      enrollment: enrollment as Parameters<typeof resendLeadMagnetDeliveryDm>[1]["enrollment"],
      campaign,
      accessToken: creds.accessToken,
      pageId: creds.pageId,
    });
    return new Response(JSON.stringify({ success: result.ok, ...result }), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST" && pathname.endsWith("/resend-email-delivery")) {
    if (!isAuthorizedServiceCall(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let payload: { enrollmentId?: string; email?: string };
    try {
      payload = await req.json() as { enrollmentId?: string; email?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const enrollmentId = (payload.enrollmentId ?? "").trim();
    if (!enrollmentId) {
      return new Response(JSON.stringify({ error: "Missing enrollmentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: enrollment, error } = await admin
      .from("lead_magnet_enrollments")
      .select("*, campaign:lead_magnet_campaigns(*)")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (error || !enrollment) {
      return new Response(JSON.stringify({ error: "Enrollment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const campaignRaw = (enrollment as { campaign?: unknown }).campaign;
    const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let email = (payload.email ?? "").trim().toLowerCase();
    if (!email.includes("@") && enrollment.lead_submission_id) {
      const { data: submission } = await admin
        .from("lead_submissions")
        .select("email")
        .eq("id", enrollment.lead_submission_id)
        .maybeSingle();
      email = String(submission?.email ?? "").trim().toLowerCase();
    }
    if (!email.includes("@")) {
      const { data: profile } = await admin
        .from("lead_magnet_participant_profiles")
        .select("email")
        .eq("organization_id", enrollment.organization_id)
        .eq("platform", enrollment.platform)
        .eq("participant_scoped_id", enrollment.participant_scoped_id)
        .maybeSingle();
      email = String(profile?.email ?? "").trim().toLowerCase();
    }
    if (!email.includes("@")) {
      return new Response(JSON.stringify({ error: "Missing recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = String(enrollment.organization_id);
    const accountId = String(campaign.account_id);
    const creds = await resolvePageCredentials(admin, orgId, accountId);
    await runAsyncDelivery(admin, {
      enrollment: enrollment as Parameters<typeof runAsyncDelivery>[1]["enrollment"],
      campaign,
      accessToken: creds?.accessToken ?? "",
      pageId: creds?.pageId ?? "",
      channel: "email",
      email,
    });
    const { data: refreshed } = await admin
      .from("lead_magnet_enrollments")
      .select("status")
      .eq("id", enrollmentId)
      .maybeSingle();
    const ok = refreshed?.status === "delivered_email";
    return new Response(JSON.stringify({ success: ok, status: refreshed?.status ?? null }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isAuthorizedServiceCall(req)) {
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
