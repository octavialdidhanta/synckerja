import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpServiceConfig } from "../config";
import {
  BRIEF_VOICE_GENERATE_HOW_TO_READ,
  type GenerateBriefVoiceInput,
  type GenerateBriefVoiceResult,
} from "../tools/content/briefsVoiceGenerate";
import {
  BRIEF_VOICE_LIST_HOW_TO_READ,
  type BriefVoiceClipPublic,
  type BriefVoiceListResult,
} from "../tools/content/briefsVoiceList";

type Session = { userId: string; organizationId: string };
type DoorConfig = Pick<McpServiceConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "scheduledPostsInternalSecret">;

const BUCKET = "brief-visual-images";

type ClipRow = {
  id: string;
  kind: string;
  row_index: number;
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

export async function listBriefVoiceClips(
  admin: SupabaseClient,
  supabaseUrl: string,
  ctx: Session,
  planId: string,
): Promise<BriefVoiceListResult> {
  const { data, error } = await admin.rpc("mcp_list_brief_voice_clips", {
    ...sessionArgs(ctx),
    p_plan_id: planId,
  });
  if (error) throw briefVoiceError(error.message ?? "");
  const rows = asRows<ClipRow>(data);
  const clips = dedupeByRow(rows.map((row) => toPublicClip(supabaseUrl, row)));
  return {
    plan_id: planId,
    count: clips.length,
    clips,
    how_to_read: BRIEF_VOICE_LIST_HOW_TO_READ,
  };
}

export async function listBriefVoiceRowIndexes(
  admin: SupabaseClient,
  ctx: Session,
  planId: string,
): Promise<Set<number>> {
  const { data, error } = await admin.rpc("mcp_list_brief_voice_clips", {
    ...sessionArgs(ctx),
    p_plan_id: planId,
  });
  if (error) throw briefVoiceError(error.message ?? "");
  return new Set(asRows<ClipRow>(data).map((row) => row.row_index));
}

function mapGenerateError(status: number, message: string): Error {
  const lower = message.toLowerCase();
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
    | { clip?: EdgeClipRow; taggedText?: string | null; error?: string }
    | null;
  if (!response.ok) {
    throw mapGenerateError(response.status, String(body?.error ?? ""));
  }
  const clipRow = body?.clip;
  const storagePath = String(clipRow?.storage_path ?? "").trim();
  if (!clipRow?.id || !storagePath) throw new Error("voice_generate_failed");

  const clip: BriefVoiceClipPublic = {
    id: String(clipRow.id),
    row_index: Number(clipRow.row_index ?? input.rowIndex),
    file_name: String(clipRow.file_name ?? `vo-${input.rowIndex + 1}.mp3`),
    spoken_text: clipRow.spoken_text?.trim() || text,
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
