import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  howToUpload,
  MEDIA_UPLOAD_CHUNK_BYTES,
  MEDIA_UPLOAD_GRANULARITY,
  MEDIA_VERSIONS_HOW_TO_READ,
  uploadNextStep,
  uploadToolError,
  type ListMediaVersionsResult,
  type StartMediaUploadInput,
  type StartMediaUploadResult,
} from "../tools/content/mediaUpload";

type Session = { userId: string; organizationId: string };
type UploadConfig = {
  publicUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  scheduledPostsInternalSecret: string;
};

const START_ERRORS = new Set([
  "not_found",
  "forbidden",
  "invalid_input",
  "not_approved",
  "production_locked",
  "not_video_content",
  "not_connected",
  "reconnect_required",
  "busy",
]);

function mimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

async function callUploadFunction(
  config: UploadConfig,
  ctx: Session,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetchImpl(`${config.supabaseUrl}/functions/v1/content-plan-media-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      organization_id: ctx.organizationId,
      mcp_user_id: ctx.userId,
      internal_secret: config.scheduledPostsInternalSecret,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

export async function startMediaUpload(
  config: UploadConfig,
  ctx: Session,
  input: StartMediaUploadInput,
  fetchImpl: typeof fetch = fetch,
): Promise<StartMediaUploadResult> {
  const { status, json } = await callUploadFunction(
    config,
    ctx,
    {
      action: "start",
      plan_id: input.planId,
      file_name: input.fileName,
      mime_type: input.mimeType ?? mimeFromName(input.fileName),
      size_bytes: input.sizeBytes,
    },
    fetchImpl,
  );
  if (status >= 400 || typeof json.ticket !== "string") {
    const code = typeof json.error === "string" && START_ERRORS.has(json.error) ? json.error : "upload_start_failed";
    throw uploadToolError(code);
  }
  const uploadUrl = `${config.publicUrl}/uploads/${json.ticket}`;
  return {
    version_id: String(json.version_id),
    version_no: Number(json.version_no),
    file_name: String(json.file_name),
    folder_url: String(json.folder_url),
    upload_url: uploadUrl,
    expires_at: String(json.expires_at),
    size_bytes: Number(json.size_bytes),
    chunk_bytes: MEDIA_UPLOAD_CHUNK_BYTES,
    how_to_upload: howToUpload(uploadUrl, Number(json.size_bytes)),
  };
}

function fileIdFromLink(link: string | null): string | null {
  const m = String(link ?? "").match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? String(link ?? "").match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export async function listMediaVersions(admin: SupabaseClient, ctx: Session, planId: string): Promise<ListMediaVersionsResult> {
  const { data: plan } = await admin
    .from("social_media_plans")
    .select("id, google_drive_link")
    .eq("id", planId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!plan) throw uploadToolError("not_found");
  const { data, error } = await admin
    .from("content_plan_media_versions")
    .select("version_no, status, drive_file_id, drive_folder_id, source, size_bytes, created_at, completed_at")
    .eq("social_media_plan_id", planId)
    .eq("organization_id", ctx.organizationId)
    .order("version_no", { ascending: false });
  if (error) throw uploadToolError("request_failed");
  const activeId = fileIdFromLink((plan as { google_drive_link: string | null }).google_drive_link);
  const rows = (data ?? []) as Array<{
    version_no: number;
    status: "uploading" | "ready" | "failed";
    drive_file_id: string | null;
    drive_folder_id: string;
    source: "web" | "mcp";
    size_bytes: number;
    created_at: string;
    completed_at: string | null;
  }>;
  return {
    plan_id: planId,
    folder_url: rows[0]?.drive_folder_id ? `https://drive.google.com/drive/folders/${rows[0].drive_folder_id}` : null,
    versions: rows.map((r) => ({
      version_no: r.version_no,
      status: r.status,
      google_drive_link: r.drive_file_id ? `https://drive.google.com/file/d/${r.drive_file_id}/view` : null,
      active: Boolean(r.drive_file_id && r.drive_file_id === activeId),
      source: r.source,
      size_bytes: Number(r.size_bytes),
      created_at: r.created_at,
      completed_at: r.completed_at,
    })),
    how_to_read: MEDIA_VERSIONS_HOW_TO_READ,
  };
}

// ---------------------------------------------------------------------------
// PUT/GET /uploads/<ticket>: bytes from the AI are forwarded to Google; the Google URL never leaves this server.
// ---------------------------------------------------------------------------

type TicketRow = {
  id: string;
  version_id: string;
  organization_id: string;
  user_id: string;
  google_upload_url: string;
  total_bytes: number;
  received_bytes: number;
  expires_at: string;
  completed_at: string | null;
};

export type UploadHttpResult = { status: number; body: Record<string, unknown> };

function httpError(status: number, code: string, extra: Record<string, unknown> = {}): UploadHttpResult {
  return { status, body: { error: code, next_step: uploadNextStep(code), ...extra } };
}

export type ParsedRange = { start: number; end: number; total: number };

/** "bytes START-END/TOTAL"; a whole small file may omit the header. */
export function parseContentRange(header: string | null, bodyLength: number, total: number): ParsedRange | "invalid" {
  if (!header) {
    return bodyLength === total && bodyLength > 0 ? { start: 0, end: total - 1, total } : "invalid";
  }
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(header.trim());
  if (!m) return "invalid";
  const start = Number(m[1]);
  const end = Number(m[2]);
  const t = Number(m[3]);
  if (t !== total || end < start || end >= total || end - start + 1 !== bodyLength) return "invalid";
  return { start, end, total };
}

export function chunkProblem(range: ParsedRange, received: number): string | null {
  if (range.start !== received) return "out_of_order";
  const size = range.end - range.start + 1;
  if (size > MEDIA_UPLOAD_CHUNK_BYTES) return "chunk_too_large";
  const last = range.end === range.total - 1;
  if (!last && size % MEDIA_UPLOAD_GRANULARITY !== 0) return "chunk_not_multiple_of_256k";
  return null;
}

export function ticketHash(ticket: string): string {
  return createHash("sha256").update(ticket).digest("hex");
}

async function loadTicket(admin: SupabaseClient, ticket: string): Promise<TicketRow | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  const { data } = await admin
    .from("content_plan_media_upload_tickets")
    .select("id, version_id, organization_id, user_id, google_upload_url, total_bytes, received_bytes, expires_at, completed_at")
    .eq("ticket_hash", ticketHash(ticket))
    .maybeSingle();
  return (data as TicketRow | null) ?? null;
}

function parseGoogleRange(header: string | null): number {
  const m = /bytes=0-(\d+)/.exec(header ?? "");
  return m ? Number(m[1]) + 1 : 0;
}

async function finishVersion(
  config: UploadConfig,
  row: TicketRow,
  fileId: string,
  fetchImpl: typeof fetch,
): Promise<UploadHttpResult> {
  const { status, json } = await callUploadFunction(
    config,
    { userId: row.user_id, organizationId: row.organization_id },
    { action: "finish", version_id: row.version_id, file_id: fileId, apply_link: true },
    fetchImpl,
  );
  if (status >= 400) return httpError(409, typeof json.error === "string" ? json.error : "finish_failed");
  return {
    status: 200,
    body: {
      done: true,
      version_no: json.version_no,
      google_drive_link: json.google_drive_link,
      link_applied: json.link_applied === true,
      production_status: json.production_status ?? null,
      ...(json.link_error
        ? {
          link_error: json.link_error,
          next_step: uploadNextStep(json.link_error === "not_approved" ? "link_not_approved" : String(json.link_error)),
        }
        : {}),
    },
  };
}

export async function getUploadStatus(admin: SupabaseClient, ticket: string): Promise<UploadHttpResult> {
  const row = await loadTicket(admin, ticket);
  if (!row) return httpError(404, "unknown_ticket");
  return {
    status: 200,
    body: {
      received_bytes: Number(row.received_bytes),
      total_bytes: Number(row.total_bytes),
      done: Boolean(row.completed_at),
      expires_at: row.expires_at,
    },
  };
}

export async function putUploadChunk(
  admin: SupabaseClient,
  config: UploadConfig,
  ticket: string,
  contentRange: string | null,
  body: Uint8Array,
  fetchImpl: typeof fetch = fetch,
): Promise<UploadHttpResult> {
  const row = await loadTicket(admin, ticket);
  if (!row) return httpError(404, "unknown_ticket");
  if (row.completed_at) return httpError(409, "already_done");
  if (new Date(row.expires_at).getTime() < Date.now()) return httpError(410, "expired");

  const total = Number(row.total_bytes);
  const range = parseContentRange(contentRange, body.byteLength, total);
  if (range === "invalid") return httpError(400, "invalid_content_range", { total_bytes: total });
  const problem = chunkProblem(range, Number(row.received_bytes));
  if (problem) {
    return httpError(409, problem, { received_bytes: Number(row.received_bytes), total_bytes: total });
  }

  let res: Response;
  try {
    res = await fetchImpl(row.google_upload_url, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${range.start}-${range.end}/${total}` },
      body: body as Uint8Array<ArrayBuffer>,
    });
  } catch {
    return httpError(502, "google_unreachable", { received_bytes: Number(row.received_bytes) });
  }

  if (res.status === 308) {
    const received = parseGoogleRange(res.headers.get("range"));
    await res.body?.cancel();
    await admin.from("content_plan_media_upload_tickets").update({ received_bytes: received }).eq("id", row.id);
    return { status: 200, body: { received_bytes: received, total_bytes: total, done: false } };
  }

  if (res.status === 200 || res.status === 201) {
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    if (!json.id) return httpError(502, "google_missing_file_id");
    await admin.from("content_plan_media_upload_tickets").update({ received_bytes: total }).eq("id", row.id);
    return finishVersion(config, row, json.id, fetchImpl);
  }

  await res.body?.cancel();
  return httpError(502, `google_http_${res.status}`, { received_bytes: Number(row.received_bytes) });
}
