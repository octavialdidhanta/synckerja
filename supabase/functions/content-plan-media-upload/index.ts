/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  appPublicOrigin,
  createOrgResumableSession,
  ensureOrgRootFolder,
  ensurePlanFolder,
  getDriveFileMeta,
  getOrgDriveAccessToken,
  getUserIdFromBearer,
  isActiveOrgMember,
  orgDriveCorsHeaders,
  orgDriveJson,
  setAnyoneWithLinkReader,
  VERSION_APP_PROP,
} from "../_shared/orgDrive/access.ts";
import {
  allowedUploadOrigin,
  driveFileViewUrl,
  isDriveId,
  normalizeVideoMime,
  parseSizeBytes,
  versionFileName,
} from "../_shared/orgDrive/naming.ts";
import {
  nextVersionNo,
  randomTicket,
  secretMatches,
  sha256Hex,
  uploadBlockReason,
  uploadedFileProblem,
} from "../_shared/orgDrive/uploadRules.ts";

/**
 * Versioned video uploads for a content plan into the organization's Google Drive.
 *
 * Callers:
 * - Office (browser): Authorization = member's Supabase session. The browser PUTs bytes straight to Google.
 * - MCP server (AI): Authorization = service role + internal_secret + mcp_user_id. The Google URL stays on
 *   the server; the AI gets a one-time Synckerja ticket instead (content_plan_media_upload_tickets).
 *
 * POST { action, ... }
 *   start          { plan_id, file_name, mime_type, size_bytes }  -> new version vN + where to send bytes
 *   finish         { version_id, file_id, apply_link? }          -> verify file, share link, mark ready
 *   schedule_info  { plan_id }                                   -> pending schedules + can_approve
 *   activate       { version_id, move_schedules }                -> switch an APPROVED plan to another version
 */

type Caller = { userId: string; via: "web" | "mcp"; mcpOrganizationId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICKET_TTL_MS = 6 * 60 * 60 * 1000;
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

function uploadOrigins(): string[] {
  const extra = (Deno.env.get("ORG_DRIVE_UPLOAD_ORIGINS") ?? "").split(",");
  return [appPublicOrigin(), "https://office.synckerja.com", ...extra].filter(Boolean);
}

async function resolveCaller(admin: SupabaseClient, req: Request, body: Record<string, unknown>): Promise<Caller | null> {
  const mcpUserId = typeof body.mcp_user_id === "string" ? body.mcp_user_id.trim() : "";
  if (mcpUserId) {
    // Same check as social-media-plan-auto-schedule / mcp-ads-performance: the shared internal secret
    // (MCP server only). The service-role bearer may use a different key format, so it is not compared.
    const expected = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
    if (!secretMatches(String(body.internal_secret ?? ""), expected)) return null;
    if (!UUID.test(mcpUserId)) return null;
    const org = typeof body.organization_id === "string" ? body.organization_id.trim() : "";
    if (!UUID.test(org)) return null;
    return { userId: mcpUserId, via: "mcp", mcpOrganizationId: org };
  }
  const userId = await getUserIdFromBearer(admin, req.headers.get("Authorization"));
  return userId ? { userId, via: "web", mcpOrganizationId: null } : null;
}

type PlanRow = {
  id: string;
  organization_id: string;
  title: string | null;
  approved: boolean | null;
  production_approved: boolean | null;
  google_drive_link: string | null;
  content_type: { name?: string | null } | null;
};

/** Plan the caller may touch: member of its org, and (for MCP) inside the session's locked org. */
async function loadPlanForCaller(admin: SupabaseClient, caller: Caller, planId: string): Promise<PlanRow | Response> {
  if (!UUID.test(planId)) return orgDriveJson({ error: "invalid_input", message: "plan_id tidak valid" }, 400);
  const { data } = await admin
    .from("social_media_plans")
    .select("id, organization_id, title, approved, production_approved, google_drive_link, content_type:content_types(name)")
    .eq("id", planId)
    .maybeSingle();
  const plan = data as PlanRow | null;
  if (!plan) return orgDriveJson({ error: "not_found" }, 404);
  if (caller.mcpOrganizationId && caller.mcpOrganizationId !== plan.organization_id) {
    return orgDriveJson({ error: "not_found" }, 404);
  }
  if (!(await isActiveOrgMember(admin, caller.userId, plan.organization_id))) {
    return orgDriveJson({ error: "forbidden" }, 403);
  }
  return plan;
}

const BLOCK_MESSAGE: Record<string, string> = {
  not_approved: "Brief konten ini belum di-approve. Video baru bisa diunggah setelah brief di-approve.",
  production_locked: "Produksi sudah di-approve, jadi video terkunci. Minta revisi dulu untuk mengunggah versi baru.",
  not_video_content: "Konten Post/Carousel memakai gambar, bukan video.",
};

async function actionStart(admin: SupabaseClient, caller: Caller, req: Request, body: Record<string, unknown>): Promise<Response> {
  const plan = await loadPlanForCaller(admin, caller, String(body.plan_id ?? "").trim());
  if (plan instanceof Response) return plan;

  const block = uploadBlockReason({
    organization_id: plan.organization_id,
    approved: plan.approved,
    production_approved: plan.production_approved,
    content_type_name: plan.content_type?.name ?? null,
  });
  if (block) return orgDriveJson({ error: block, message: BLOCK_MESSAGE[block] }, 409);

  const mime = normalizeVideoMime(String(body.mime_type ?? ""), String(body.file_name ?? ""));
  if (!mime) return orgDriveJson({ error: "invalid_input", message: "Hanya video MP4, MOV, WebM, atau M4V." }, 400);
  const size = parseSizeBytes(body.size_bytes);
  if (!size) return orgDriveJson({ error: "invalid_input", message: "Ukuran video harus 10 KB sampai 512 MB." }, 400);

  let origin: string | null = null;
  if (caller.via === "web") {
    origin = allowedUploadOrigin(req.headers.get("Origin"), uploadOrigins());
    if (!origin) return orgDriveJson({ error: "origin_not_allowed" }, 403);
  }

  const tok = await getOrgDriveAccessToken(admin, plan.organization_id);
  if (!tok.ok) return orgDriveJson({ error: tok.code, message: tok.message }, 409);

  const rootId = await ensureOrgRootFolder(admin, plan.organization_id, tok.accessToken, tok.rootFolderId);
  const folderId = await ensurePlanFolder(admin, {
    orgId: plan.organization_id,
    planId: plan.id,
    title: plan.title,
    token: tok.accessToken,
    rootFolderId: rootId,
    email: tok.email,
  });

  // Uploads abandoned for a day are marked failed so they don't look "in progress" forever.
  await admin
    .from("content_plan_media_versions")
    .update({ status: "failed", error_message: "upload_abandoned" })
    .eq("social_media_plan_id", plan.id)
    .eq("status", "uploading")
    .lt("created_at", new Date(Date.now() - STALE_UPLOAD_MS).toISOString());

  let version: { id: string; version_no: number } | null = null;
  for (let attempt = 0; attempt < 3 && !version; attempt += 1) {
    const { data: rows } = await admin
      .from("content_plan_media_versions")
      .select("version_no")
      .eq("social_media_plan_id", plan.id);
    const versionNo = nextVersionNo((rows ?? []).map((r) => Number((r as { version_no: number }).version_no)));
    const { data, error } = await admin
      .from("content_plan_media_versions")
      .insert({
        organization_id: plan.organization_id,
        social_media_plan_id: plan.id,
        version_no: versionNo,
        status: "uploading",
        drive_folder_id: folderId,
        file_name: versionFileName(versionNo, mime),
        mime_type: mime,
        size_bytes: size,
        source: caller.via,
        uploaded_by: caller.userId,
        google_account_email: tok.email,
      })
      .select("id, version_no")
      .single();
    if (!error && data) version = data as { id: string; version_no: number };
    else if (error && !String(error.code).startsWith("23505")) throw new Error(`version_insert_failed: ${error.message}`);
  }
  if (!version) return orgDriveJson({ error: "busy", message: "Ada upload lain bersamaan. Coba lagi." }, 409);

  let uploadUrl: string;
  try {
    uploadUrl = await createOrgResumableSession({
      token: tok.accessToken,
      fileName: versionFileName(version.version_no, mime),
      mimeType: mime,
      sizeBytes: size,
      folderId,
      versionId: version.id,
      origin,
    });
  } catch (e) {
    await admin.from("content_plan_media_versions").update({ status: "failed", error_message: (e as Error).message.slice(0, 300) }).eq("id", version.id);
    throw e;
  }

  const common = {
    version_id: version.id,
    version_no: version.version_no,
    file_name: versionFileName(version.version_no, mime),
    folder_url: `https://drive.google.com/drive/folders/${folderId}`,
    size_bytes: size,
  };

  if (caller.via === "web") return orgDriveJson({ ...common, upload_url: uploadUrl });

  const ticket = randomTicket();
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();
  const { error: ticketErr } = await admin.from("content_plan_media_upload_tickets").insert({
    ticket_hash: await sha256Hex(ticket),
    version_id: version.id,
    organization_id: plan.organization_id,
    user_id: caller.userId,
    google_upload_url: uploadUrl,
    total_bytes: size,
    expires_at: expiresAt,
  });
  if (ticketErr) throw new Error(`ticket_insert_failed: ${ticketErr.message}`);
  return orgDriveJson({ ...common, ticket, expires_at: expiresAt });
}

async function actionFinish(admin: SupabaseClient, caller: Caller, body: Record<string, unknown>): Promise<Response> {
  const versionId = String(body.version_id ?? "").trim();
  const fileId = String(body.file_id ?? "").trim();
  if (!UUID.test(versionId) || !isDriveId(fileId)) return orgDriveJson({ error: "invalid_input" }, 400);

  const { data: v } = await admin
    .from("content_plan_media_versions")
    .select("id, organization_id, social_media_plan_id, version_no, status, drive_folder_id, size_bytes, uploaded_by, drive_file_id")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) return orgDriveJson({ error: "not_found" }, 404);
  if (v.uploaded_by !== caller.userId) return orgDriveJson({ error: "forbidden" }, 403);
  if (caller.mcpOrganizationId && caller.mcpOrganizationId !== v.organization_id) return orgDriveJson({ error: "not_found" }, 404);
  if (!(await isActiveOrgMember(admin, caller.userId, String(v.organization_id)))) return orgDriveJson({ error: "forbidden" }, 403);

  const link = driveFileViewUrl(fileId);
  if (v.status === "ready") {
    if (v.drive_file_id !== fileId) return orgDriveJson({ error: "conflict" }, 409);
    return orgDriveJson({ version_id: v.id, version_no: v.version_no, google_drive_link: link, already_finished: true });
  }
  if (v.status !== "uploading") return orgDriveJson({ error: "upload_not_active" }, 409);

  const tok = await getOrgDriveAccessToken(admin, String(v.organization_id));
  if (!tok.ok) return orgDriveJson({ error: tok.code, message: tok.message }, 409);

  const meta = await getDriveFileMeta(tok.accessToken, fileId);
  const problem = uploadedFileProblem(
    { versionId: v.id, folderId: String(v.drive_folder_id), expectedBytes: Number(v.size_bytes), meta },
    VERSION_APP_PROP,
  );
  if (problem) {
    if (problem !== "file_not_found") {
      await admin.from("content_plan_media_versions").update({ status: "failed", error_message: problem }).eq("id", v.id);
    }
    return orgDriveJson({ error: problem }, 409);
  }

  let shareWarning: string | null = null;
  try {
    await setAnyoneWithLinkReader(tok.accessToken, fileId);
  } catch (e) {
    shareWarning = (e as Error).message.slice(0, 200);
  }

  const { error: upErr } = await admin
    .from("content_plan_media_versions")
    .update({ status: "ready", drive_file_id: fileId, completed_at: new Date().toISOString(), error_message: shareWarning })
    .eq("id", v.id)
    .eq("status", "uploading");
  if (upErr) throw new Error(`version_update_failed: ${upErr.message}`);

  await admin
    .from("content_plan_media_upload_tickets")
    .update({ completed_at: new Date().toISOString(), received_bytes: Number(v.size_bytes) })
    .eq("version_id", v.id);

  // Office applies the link through its normal save path (Need Review, PIC, task step).
  // The MCP path uses the same rules on the server.
  let applied: { production_status: string | null; changed: boolean } | null = null;
  if (body.apply_link === true) {
    const { data, error } = await admin.rpc("mcp_set_content_plan_drive_link", {
      p_user_id: caller.userId,
      p_organization_id: v.organization_id,
      p_plan_id: v.social_media_plan_id,
      p_url: link,
    });
    if (error) {
      return orgDriveJson({
        version_id: v.id,
        version_no: v.version_no,
        google_drive_link: link,
        link_applied: false,
        link_error: error.message.includes("not_approved") ? "not_approved" : "link_not_applied",
      });
    }
    const row = (Array.isArray(data) ? data[0] : data) as { production_status?: string | null; changed?: boolean } | null;
    applied = { production_status: row?.production_status ?? null, changed: row?.changed === true };
  }

  return orgDriveJson({
    version_id: v.id,
    version_no: v.version_no,
    google_drive_link: link,
    share_warning: shareWarning,
    link_applied: applied !== null,
    production_status: applied?.production_status ?? null,
  });
}

async function actionScheduleInfo(admin: SupabaseClient, caller: Caller, body: Record<string, unknown>): Promise<Response> {
  const plan = await loadPlanForCaller(admin, caller, String(body.plan_id ?? "").trim());
  if (plan instanceof Response) return plan;
  const { data: rows } = await admin
    .from("social_media_scheduled_posts")
    .select("platform, scheduled_at, timezone")
    .eq("social_media_plan_id", plan.id)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true });
  const { data: canApprove } = await admin.rpc("can_approve_content_production", {
    p_user_id: caller.userId,
    p_organization_id: plan.organization_id,
  });
  return orgDriveJson({
    pending: (rows ?? []).map((r) => ({
      platform: (r as { platform: string }).platform,
      scheduled_at: (r as { scheduled_at: string }).scheduled_at,
      timezone: (r as { timezone: string | null }).timezone,
    })),
    production_approved: plan.production_approved === true,
    can_approve_production: canApprove === true,
  });
}

async function actionActivate(admin: SupabaseClient, caller: Caller, body: Record<string, unknown>): Promise<Response> {
  const versionId = String(body.version_id ?? "").trim();
  if (!UUID.test(versionId)) return orgDriveJson({ error: "invalid_input" }, 400);
  const { data: v } = await admin
    .from("content_plan_media_versions")
    .select("id, organization_id, social_media_plan_id, drive_file_id, status")
    .eq("id", versionId)
    .maybeSingle();
  if (!v || v.status !== "ready" || !v.drive_file_id) return orgDriveJson({ error: "not_found" }, 404);
  const plan = await loadPlanForCaller(admin, caller, String(v.social_media_plan_id));
  if (plan instanceof Response) return plan;
  if (plan.production_approved !== true) {
    // Not locked yet: Office saves the link like any other link (Need Review flow).
    return orgDriveJson({ error: "use_normal_save" }, 409);
  }

  const { data, error } = await admin.rpc("activate_content_plan_media_version", {
    p_user_id: caller.userId,
    p_version_id: v.id,
    p_new_link: driveFileViewUrl(String(v.drive_file_id)),
    p_move_schedules: body.move_schedules === true,
  });
  if (error) {
    if (error.message.includes("forbidden")) {
      return orgDriveJson({ error: "forbidden", message: "Hanya yang boleh approve produksi yang bisa mengganti versi setelah di-approve." }, 403);
    }
    throw new Error(`activate_failed: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    google_drive_link: string;
    moved_schedules: number;
    cancelled_schedules: number;
  };
  return orgDriveJson({
    google_drive_link: row.google_drive_link,
    moved_schedules: row.moved_schedules,
    cancelled_schedules: row.cancelled_schedules,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: orgDriveCorsHeaders });
  if (req.method !== "POST") return orgDriveJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return orgDriveJson({ error: "Server misconfigured" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return orgDriveJson({ error: "Invalid JSON body" }, 400);
  }

  const caller = await resolveCaller(admin, req, body);
  if (!caller) return orgDriveJson({ error: "Unauthorized" }, 401);

  try {
    switch (String(body.action ?? "")) {
      case "start":
        return await actionStart(admin, caller, req, body);
      case "finish":
        return await actionFinish(admin, caller, body);
      case "schedule_info":
        return await actionScheduleInfo(admin, caller, body);
      case "activate":
        if (caller.via !== "web") return orgDriveJson({ error: "forbidden" }, 403);
        return await actionActivate(admin, caller, body);
      default:
        return orgDriveJson({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    const message = (e as Error).message ?? "error";
    console.error("content-plan-media-upload:", message);
    return orgDriveJson({ error: "server_error", message: message.replace(/https:\/\/\S+/g, "").slice(0, 200) }, 500);
  }
});
