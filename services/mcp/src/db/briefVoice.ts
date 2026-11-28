import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpServiceConfig } from "../config";
import {
  BRIEF_VOICE_GENERATE_HOW_TO_READ,
  type GenerateBriefVoiceInput,
  type GenerateBriefVoiceResult,
} from "../tools/content/briefsVoiceGenerate";
import { mp3FileName, readMp3, VOICE_GET_MAX_BYTES } from "../tools/content/briefVoiceMp3";
import {
  BRIEF_VOICE_GET_HOW_TO_READ,
  type BriefVoiceGetResult,
  type GetBriefVoiceInput,
} from "../tools/content/briefsVoiceGet";
import {
  mintVoiceDownloadToken,
  verifyVoiceDownloadToken,
  voiceDownloadNextStep,
  voiceDownloadUrl,
  VOICE_DOWNLOAD_MAX_BYTES,
} from "../tools/content/voiceDownload";
import {
  BRIEF_VOICE_LIST_HOW_TO_READ,
  type BriefVoiceClipPublic,
  type BriefVoiceListResult,
} from "../tools/content/briefsVoiceList";
import { parseStoredBrief } from "../tools/content/briefRead";
import { narrationSource, voiceClipStale } from "../tools/content/voiceStale";
import { clipBelongsToShot } from "../../../../src/6-1-dashboard/modal/briefShotMatch";

type Session = { userId: string; organizationId: string };
type DoorConfig = Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">;

const BUCKET = "brief-visual-images";

type ClipRow = {
  id: string;
  kind: string;
  row_index: number;
  shot_id?: string | null;
  file_name: string;
  spoken_text: string | null;
  storage_path: string;
  created_at: string;
};

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

function briefVoiceError(message: string): Error {
  if (message.includes("not_found")) return new Error("not_found");
  if (message.includes("not_a_member") || message.includes("forbidden")) return new Error("forbidden");
  if (message.includes("invalid_input")) return new Error("invalid_input");
  return new Error("request_failed");
}

/** Public object URL for brief-visual-images (same pattern as Office getPublicUrl). */
export function briefVoicePublicUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

function toPublicClip(supabaseUrl: string, row: ClipRow): BriefVoiceClipPublic {
  return {
    id: row.id,
    row_index: row.row_index,
    file_name: row.file_name,
    spoken_text: row.spoken_text?.trim() || null,
    shot_id: row.shot_id ?? null,
    download_url: briefVoicePublicUrl(supabaseUrl, row.storage_path),
    created_at: row.created_at,
  };
}

/** One clip per row_index (newest first from RPC order). */
function dedupeByRow(clips: BriefVoiceClipPublic[]): BriefVoiceClipPublic[] {
  const seen = new Set<number>();
  const out: BriefVoiceClipPublic[] = [];
  for (const clip of clips) {
    if (seen.has(clip.row_index)) continue;
    seen.add(clip.row_index);
    out.push(clip);
  }
  return out;
}

async function fetchClipRows(admin: SupabaseClient, ctx: Session, planId: string): Promise<ClipRow[]> {
  const { data, error } = await admin.rpc("mcp_list_brief_voice_clips", {
    ...sessionArgs(ctx),
    p_plan_id: planId,
  });
  if (error) throw briefVoiceError(error.message ?? "");
  return asRows<ClipRow>(data);
}

export async function listVoClipRows(admin: SupabaseClient, ctx: Session, planId: string): Promise<ClipRow[]> {
  return fetchClipRows(admin, ctx, planId);
}

export type StoryboardShotRow = { id: string; row_index: number };

export async function listStoryboardShots(admin: SupabaseClient, planId: string): Promise<StoryboardShotRow[]> {
  if (typeof admin.from !== "function") return [];
  const { data, error } = await admin
    .from("brief_storyboard_shots")
    .select("id, row_index")
    .eq("social_media_plan_id", planId)
    .order("row_index", { ascending: true });
  if (error) throw briefVoiceError(error.message ?? "");
  return asRows<StoryboardShotRow>(data);
}

type NarrationLines = { lines: string[]; voiceOver: string | null };

async function narrationLinesForPlan(admin: SupabaseClient, ctx: Session, planId: string): Promise<NarrationLines> {
  const { data, error } = await admin.rpc("mcp_get_content_brief", { ...sessionArgs(ctx), p_id: planId });
  if (error) throw briefVoiceError(error.message ?? "");
  const row = asRows<{ brief?: string | null; concept?: { voice_over?: string | null } | null }>(data)[0];
  if (!row) throw new Error("not_found");
  const voiceOver = row.concept?.voice_over?.trim() || null;
  const { storyboard } = parseStoredBrief(row.brief);
  const lines: string[] = [];
  for (const sequence of storyboard?.sequences ?? []) {
    for (const shot of sequence.shots) lines.push(narrationSource(shot.vo, voiceOver));
  }
  return { lines, voiceOver };
}

function sourceForRow(sources: NarrationLines, rowIndex: number): string {
  if (rowIndex >= 0 && rowIndex < sources.lines.length) return sources.lines[rowIndex];
  return narrationSource("", sources.voiceOver);
}

export async function listBriefVoiceClips(
  admin: SupabaseClient,
  supabaseUrl: string,
  ctx: Session,
  planId: string,
): Promise<BriefVoiceListResult> {
  const clips = dedupeByRow((await fetchClipRows(admin, ctx, planId)).map((row) => toPublicClip(supabaseUrl, row)));
  if (clips.length > 0) {
    const sources = await narrationLinesForPlan(admin, ctx, planId);
    const shots = await listStoryboardShots(admin, planId);
    for (const clip of clips) {
      const shot = clip.shot_id ? shots.find((item) => item.id === clip.shot_id) : null;
      const index = shot ? shot.row_index : clip.row_index;
      clip.stale = voiceClipStale(clip.spoken_text, sourceForRow(sources, index));
    }
  }
  return {
    plan_id: planId,
    count: clips.length,
    clips,
    how_to_read: BRIEF_VOICE_LIST_HOW_TO_READ,
  };
}

export function mapGenerateError(status: number, message: string, code = ""): Error {
  const lower = message.toLowerCase();
  // ElevenLabs balance spent (generate-brief-voice answers 402 + code): retrying cannot help until the owner tops up.
  if (code === "voice_credit_exhausted" || status === 402 || lower.includes("kredit elevenlabs habis")) {
    return new Error("voice_credit_exhausted");
  }
  if (status === 403 || lower.includes("hanya pic") || lower.includes("pic plan")) {
    return new Error("not_pic");
  }
  if (lower.includes("voice ai belum") || lower.includes("belum dikonfigurasi")) {
    return new Error("voice_ai_not_configured");
  }
  if (status === 429 || lower.includes("batas harian")) return new Error("rate_limited");
  if (status === 400 || lower.includes("narasi")) return new Error("invalid_input");
  return new Error("voice_generate_failed");
}

type EdgeClipRow = {
  id?: string;
  kind?: string;
  row_index?: number;
  shot_id?: string | null;
  file_name?: string;
  spoken_text?: string | null;
  storage_path?: string;
  created_at?: string;
};

/** Generate one VO clip via generate-brief-voice (internal secret + PIC checks). */
export async function generateBriefVoiceClip(
  admin: SupabaseClient,
  config: DoorConfig,
  ctx: Session,
  input: GenerateBriefVoiceInput,
  fetchImpl: typeof fetch = fetch,
): Promise<GenerateBriefVoiceResult> {
  const text = input.text.trim();
  if (!text) throw new Error("invalid_input");

  const secret = config.scheduledPostsInternalSecret;
  const response = await fetchImpl(`${config.supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-brief-voice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
      "Content-Type": "application/json",
      "x-synckerja-internal-secret": secret,
    },
    body: JSON.stringify({
      action: "tts",
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      planId: input.planId,
      rowIndex: input.rowIndex,
      text,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { clip?: EdgeClipRow; taggedText?: string | null; error?: string; code?: string }
    | null;
  if (!response.ok) {
    throw mapGenerateError(response.status, String(body?.error ?? ""), String(body?.code ?? ""));
  }
  const clipRow = body?.clip;
  const storagePath = String(clipRow?.storage_path ?? "").trim();
  if (!clipRow?.id || !storagePath) throw new Error("voice_generate_failed");

  const clip: BriefVoiceClipPublic = {
    id: String(clipRow.id),
    row_index: Number(clipRow.row_index ?? input.rowIndex),
    file_name: String(clipRow.file_name ?? `vo-${input.rowIndex + 1}.mp3`),
    spoken_text: clipRow.spoken_text?.trim() || text,
    shot_id: clipRow.shot_id ?? null,
    download_url: briefVoicePublicUrl(config.supabaseUrl, storagePath),
    created_at: String(clipRow.created_at ?? new Date().toISOString()),
  };

  return {
    plan_id: input.planId,
    clip,
    tagged_text: body?.taggedText ?? null,
    how_to_read: BRIEF_VOICE_GENERATE_HOW_TO_READ,
  };
}

function pickClip(rows: ClipRow[], input: GetBriefVoiceInput): ClipRow | null {
  if (input.clipId) return rows.find((row) => row.id === input.clipId) ?? null;
  if (input.rowIndex == null) return null;
  return rows.find((row) => row.row_index === input.rowIndex) ?? null;
}

async function storedByteLength(admin: SupabaseClient, storagePath: string): Promise<number | null> {
  const slash = storagePath.lastIndexOf("/");
  const folder = slash >= 0 ? storagePath.slice(0, slash) : "";
  const name = slash >= 0 ? storagePath.slice(slash + 1) : storagePath;
  const { data, error } = await admin.storage.from(BUCKET).list(folder, { search: name, limit: 100 });
  if (error || !data) return null;
  const match = data.find((item) => item.name === name);
  const size = Number(match?.metadata?.size);
  return Number.isFinite(size) ? size : null;
}

export type VoiceDownloadSigner = {
  key: Buffer;
  publicUrl: string;
  now?: () => number;
};

async function listClipRows(admin: SupabaseClient, ctx: Session, planId: string): Promise<ClipRow[]> {
  const { data, error } = await admin.rpc("mcp_list_brief_voice_clips", {
    ...sessionArgs(ctx),
    p_plan_id: planId,
  });
  if (error) throw briefVoiceError(error.message ?? "");
  return asRows<ClipRow>(data);
}

async function readClipBytes(admin: SupabaseClient, storagePath: string, maxBytes: number): Promise<Uint8Array> {
  const knownSize = await storedByteLength(admin, storagePath);
  if (knownSize != null && knownSize > maxBytes) throw new Error("clip_too_large");
  const downloaded = await admin.storage.from(BUCKET).download(storagePath);
  if (downloaded.error || !downloaded.data) throw new Error("not_found");
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("clip_too_large");
  return bytes;
}

/** Stored word timings of one clip (org-checked); null when the clip has none or the column is not there yet. */
export function parseWordTimings(value: unknown): Array<{ text: string; start: number; end: number }> | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((w) => w as { text?: unknown; start?: unknown; end?: unknown })
    .filter((w) => typeof w.text === "string" && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)))
    .map((w) => ({ text: String(w.text), start: Number(w.start), end: Number(w.end) }));
  return out.length ? out : null;
}

async function readWordTimings(admin: SupabaseClient, ctx: Session, clipId: string) {
  try {
    const { data, error } = await admin
      .from("brief_voice_clips")
      .select("word_timings")
      .eq("id", clipId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (error || !data) return null;
    return parseWordTimings((data as { word_timings?: unknown }).word_timings);
  } catch {
    // Timings are extra: a missing column or a failed read must not break the download link.
    return null;
  }
}

/**
 * One VO clip: metadata plus a 15-minute download link on the MCP host (the file never passes
 * through the model). audio_base64 only when the caller asks for it and the clip is at most 1 MB.
 * Reuses the org-locked list RPC.
 */
export async function getBriefVoiceClip(
  admin: SupabaseClient,
  ctx: Session,
  input: GetBriefVoiceInput,
  signer: VoiceDownloadSigner,
): Promise<BriefVoiceGetResult> {
  const row = pickClip(await listClipRows(admin, ctx, input.planId), input);
  if (!row?.storage_path) throw new Error("not_found");

  const bytes = await readClipBytes(
    admin,
    row.storage_path,
    input.includeBase64 ? VOICE_GET_MAX_BYTES : VOICE_DOWNLOAD_MAX_BYTES,
  );
  const mp3 = readMp3(bytes, VOICE_DOWNLOAD_MAX_BYTES);
  if (!mp3) throw new Error("clip_not_mp3");

  const words = await readWordTimings(admin, ctx, row.id);
  const { token, expiresAt } = mintVoiceDownloadToken(
    signer.key,
    { userId: ctx.userId, organizationId: ctx.organizationId, planId: input.planId, clipId: row.id },
    signer.now?.() ?? Date.now(),
  );

  return {
    plan_id: input.planId,
    clip: {
      id: row.id,
      row_index: row.row_index,
      file_name: mp3FileName(row.file_name, row.row_index),
      spoken_text: row.spoken_text?.trim() || null,
      mime_type: mp3.mimeType,
      duration_seconds: mp3.durationSeconds,
      byte_length: bytes.byteLength,
      download_url: voiceDownloadUrl(signer.publicUrl, token),
      download_expires_at: new Date(expiresAt * 1000).toISOString(),
      ...(input.includeBase64 ? { audio_base64: Buffer.from(bytes).toString("base64") } : {}),
      words,
    },
    how_to_read: BRIEF_VOICE_GET_HOW_TO_READ,
  };
}

export type VoiceDownloadResponse =
  | { status: 200; fileName: string; bytes: Uint8Array }
  | { status: number; body: { error: string; next_step: string } };

function downloadError(status: number, code: string): VoiceDownloadResponse {
  return { status, body: { error: code, next_step: voiceDownloadNextStep(code) } };
}

/** GET /downloads/voice/<token>: verify the link, re-check membership, then serve the MP3. */
export async function downloadVoiceClip(
  admin: SupabaseClient,
  key: Buffer,
  token: string,
  nowMs: number = Date.now(),
): Promise<VoiceDownloadResponse> {
  const check = verifyVoiceDownloadToken(key, token, nowMs);
  if (!check.ok) return check.reason === "expired" ? downloadError(410, "expired") : downloadError(404, "unknown_link");
  const { userId, organizationId, planId, clipId } = check.claims;

  try {
    const rows = await listClipRows(admin, { userId, organizationId }, planId);
    const row = rows.find((item) => item.id === clipId);
    if (!row?.storage_path) return downloadError(404, "not_found");
    const bytes = await readClipBytes(admin, row.storage_path, VOICE_DOWNLOAD_MAX_BYTES);
    if (!readMp3(bytes, VOICE_DOWNLOAD_MAX_BYTES)) return downloadError(422, "clip_not_mp3");
    return { status: 200, fileName: mp3FileName(row.file_name, row.row_index), bytes };
  } catch (error) {
    const code = error instanceof Error ? error.message : "request_failed";
    if (code === "forbidden") return downloadError(403, "forbidden");
    if (code === "not_found") return downloadError(404, "not_found");
    if (code === "clip_too_large") return downloadError(413, "clip_too_large");
    return downloadError(502, "request_failed");
  }
}
