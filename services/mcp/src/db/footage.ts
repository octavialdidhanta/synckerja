import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

export type FootageScene = {
  file_key: string;
  scene_index: number;
  start_seconds: number;
  end_seconds: number | null;
  scene_kind: string;
  summary: string | null;
  location_label: string | null;
  product_label: string | null;
  media_type: string;
  thumb_storage_path: string | null;
  thumb_required: boolean;
  hijab: boolean;
  watermark_ui: boolean;
  lengkuas: boolean;
  meja_biru: boolean;
  tags?: Record<string, boolean | string>;
  usage_count: number;
  banned: boolean;
  ban_reason: string | null;
};

export type FootageSearchFilters = {
  location?: string;
  product?: string;
  scene_kind?: string;
  hijab?: boolean;
  watermark?: boolean;
  media_type?: "video" | "image";
  unused?: boolean;
  query?: string;
  include_banned?: boolean;
  limit?: number;
  /** Generic tag filters resolved via footage_tag_defs (bool or text). */
  tags?: Record<string, boolean | string>;
};

export type FootageSearchResult = {
  total: number;
  scenes: FootageScene[];
};

export type FootageClip = {
  file_key: string;
  media_type: string;
  origin: string;
  location_label: string | null;
  product_label: string | null;
  summary: string | null;
  note: string | null;
  duration_seconds: number | null;
  storage_status: string;
  scenes: FootageScene[];
};

export type FootageBan = {
  file_key: string;
  scene_index: number;
  reason: string;
};

export type FootageBansResult = {
  total: number;
  bans: FootageBan[];
};

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

async function callJson<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  if (value == null) throw new Error("not_found");
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export async function searchFootage(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageSearchFilters,
): Promise<FootageSearchResult> {
  const row = await callJson<FootageSearchResult>(admin, "mcp_search_footage", {
    ...sessionArgs(ctx),
    p_location: input.location ?? null,
    p_product: input.product ?? null,
    p_scene_kind: input.scene_kind ?? null,
    p_hijab: input.hijab ?? null,
    p_watermark: input.watermark ?? null,
    p_media_type: input.media_type ?? null,
    p_unused: input.unused ?? null,
    p_limit: input.limit ?? null,
    p_query: input.query ?? null,
    p_include_banned: input.include_banned ?? null,
    p_tags: input.tags ?? null,
  });
  return {
    total: Number(row.total ?? 0),
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
  };
}

export async function getFootage(admin: SupabaseClient, ctx: Session, fileKey: string): Promise<FootageClip> {
  const row = await callJson<FootageClip>(admin, "mcp_get_footage", {
    ...sessionArgs(ctx),
    p_file_key: fileKey,
  });
  return { ...row, scenes: Array.isArray(row.scenes) ? row.scenes : [] };
}

export async function listFootageBans(admin: SupabaseClient, ctx: Session): Promise<FootageBansResult> {
  const row = await callJson<FootageBansResult>(admin, "mcp_list_footage_bans", sessionArgs(ctx));
  return {
    total: Number(row.total ?? 0),
    bans: Array.isArray(row.bans) ? row.bans : [],
  };
}

export type FootageScenePatch = {
  scene_index: number;
  scene_kind?: string;
  summary?: string;
  note?: string;
  hijab?: boolean;
  watermark?: boolean;
  meja_biru?: boolean;
  lengkuas?: boolean;
  tags?: Record<string, boolean | string>;
};

export type FootageSceneBatchInput = {
  file_key: string;
  scenes: FootageScenePatch[];
};

export type FootageSceneChange = {
  scene_index: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

export type FootageSceneBatchPreview = {
  file_key: string;
  changes: FootageSceneChange[];
  preview_id: string;
  expires_at: string;
};

export type FootageSceneBatchSaved = {
  saved: boolean;
  file_key: string;
  scene_count: number;
};

export type FootageUsageInput = {
  file_key: string;
  external_ref: string;
  in_seconds: number;
  out_seconds: number;
  title?: string;
};

export type FootageUsagePreview = {
  file_key: string;
  external_ref: string;
  in_seconds: number;
  out_seconds: number;
  title: string | null;
  already_logged: boolean;
  can_save: boolean;
  preview_id?: string;
  expires_at?: string;
};

export type FootageUsageSaved = {
  saved: boolean;
  already_logged: boolean;
  file_key: string;
  external_ref: string;
  in_seconds?: number;
  out_seconds?: number;
};

export type FootageMoveInput = {
  file_key: string;
  new_file_key: string;
  location?: string;
  product?: string;
};

export type FootageAddress = {
  file_key: string;
  location_label: string | null;
  product_label: string | null;
  storage_status: string;
};

export type FootageMovePreview = {
  file_key: string;
  new_file_key: string;
  before: FootageAddress;
  after: FootageAddress;
  preview_id: string;
  expires_at: string;
};

export type FootageMoveSaved = {
  saved: boolean;
  file_key: string;
  previous_file_key: string;
  storage_status: string;
};

export type FootageBanInput = {
  file_key: string;
  scene_index: number;
  reason: string;
};

export type FootageBanPreview = {
  file_key: string;
  scene_index: number;
  before_reason: string | null;
  after_reason: string;
  preview_id: string;
  expires_at: string;
};

export type FootageBanSaved = {
  saved: boolean;
  file_key: string;
  scene_index: number;
  reason: string;
};

export async function previewFootageSceneBatch(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageSceneBatchInput,
): Promise<FootageSceneBatchPreview> {
  const row = await callJson<FootageSceneBatchPreview>(admin, "mcp_preview_footage_scene_batch", {
    ...sessionArgs(ctx),
    p_input: input,
  });
  return { ...row, changes: Array.isArray(row.changes) ? row.changes : [] };
}

export async function applyFootageSceneBatch(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageSceneBatchSaved> {
  return callJson<FootageSceneBatchSaved>(admin, "mcp_apply_footage_scene_batch", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewFootageUsage(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageUsageInput,
): Promise<FootageUsagePreview> {
  return callJson<FootageUsagePreview>(admin, "mcp_preview_footage_usage", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyFootageUsage(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageUsageSaved> {
  return callJson<FootageUsageSaved>(admin, "mcp_apply_footage_usage", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewFootageMove(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageMoveInput,
): Promise<FootageMovePreview> {
  return callJson<FootageMovePreview>(admin, "mcp_preview_footage_move", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyFootageMove(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageMoveSaved> {
  return callJson<FootageMoveSaved>(admin, "mcp_apply_footage_move", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewFootageBan(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageBanInput,
): Promise<FootageBanPreview> {
  return callJson<FootageBanPreview>(admin, "mcp_preview_footage_ban", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyFootageBan(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageBanSaved> {
  return callJson<FootageBanSaved>(admin, "mcp_apply_footage_ban", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export type FootageClipUpsertInput = {
  file_key: string;
  location?: string;
  product?: string;
  summary?: string;
  note?: string;
  note_mode?: "replace" | "append";
  origin?: "hp" | "ai" | "foto";
};

export type FootageClipLabels = {
  location_label?: string | null;
  product_label?: string | null;
  summary?: string | null;
  note?: string | null;
  origin?: string | null;
};

export type FootageClipUpsertPreview = {
  file_key: string;
  before: FootageClipLabels;
  after: FootageClipLabels;
  preview_id: string;
  expires_at: string;
};

export type FootageClipUpsertSaved = {
  saved: boolean;
  file_key: string;
  before: FootageClipLabels;
  after: FootageClipLabels;
};

export async function previewFootageClip(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageClipUpsertInput,
): Promise<FootageClipUpsertPreview> {
  return callJson<FootageClipUpsertPreview>(admin, "mcp_preview_footage_clip", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyFootageClip(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageClipUpsertSaved> {
  return callJson<FootageClipUpsertSaved>(admin, "mcp_apply_footage_clip", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export type FootageClipCreateScene = {
  start_seconds: number;
  end_seconds?: number | null;
  scene_kind: string;
  summary?: string;
  note?: string;
  hijab?: boolean;
  watermark?: boolean;
  meja_biru?: boolean;
  lengkuas?: boolean;
};

export type FootageClipCreateInput = {
  file_key: string;
  media_type: "video" | "image";
  origin: "hp" | "ai" | "foto";
  location?: string;
  product?: string;
  summary?: string;
  note?: string;
  duration_seconds?: number | null;
  storage_status?: "inbox" | "bank";
  scenes: FootageClipCreateScene[];
};

export type FootageClipCreatePreview = {
  clip: Record<string, unknown>;
  scenes: Array<Record<string, unknown>>;
  scene_count: number;
  preview_id: string;
  expires_at: string;
};

export type FootageClipCreateSaved = {
  saved: boolean;
  file_key: string;
  storage_status: string;
  scene_count: number;
};

export async function previewFootageClipCreate(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageClipCreateInput,
): Promise<FootageClipCreatePreview> {
  return callJson<FootageClipCreatePreview>(admin, "mcp_preview_footage_clip_create", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyFootageClipCreate(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageClipCreateSaved> {
  return callJson<FootageClipCreateSaved>(admin, "mcp_apply_footage_clip_create", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export type FootageStorageFile = { kind: string; path: string };

export type FootageDeleteInput = {
  file_key: string;
  acknowledge_used?: boolean;
};

export type FootageDeletePreview = {
  file_key: string;
  media_type?: string | null;
  summary?: string | null;
  scene_count: number;
  storage_files: FootageStorageFile[];
  used?: boolean;
  usage_count?: number;
  usages?: unknown[];
  can_save?: boolean;
  storage_kept?: boolean;
  preview_id?: string;
  expires_at?: string;
};

export type FootageDeleteSaved = {
  saved: boolean;
  file_key: string;
  deleted_at: string;
  purge_after: string;
  storage_kept: boolean;
  storage_files: FootageStorageFile[];
};

export type FootageRestoreInput = { file_key: string };

export type FootageRestorePreview = {
  file_key: string;
  deleted_at: string;
  purge_after?: string | null;
  scene_count: number;
  can_save?: boolean;
  reason?: string;
  preview_id?: string;
  expires_at?: string;
};

export type FootageRestoreSaved = {
  saved: boolean;
  file_key: string;
  deleted_at: string | null;
};

export async function previewFootageDelete(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageDeleteInput,
): Promise<FootageDeletePreview> {
  const row = await callJson<FootageDeletePreview>(admin, "mcp_preview_footage_delete", {
    ...sessionArgs(ctx),
    p_input: input,
  });
  return { ...row, storage_files: Array.isArray(row.storage_files) ? row.storage_files : [] };
}

export async function applyFootageDelete(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageDeleteSaved> {
  return callJson<FootageDeleteSaved>(admin, "mcp_apply_footage_delete", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewFootageRestore(
  admin: SupabaseClient,
  ctx: Session,
  input: FootageRestoreInput,
): Promise<FootageRestorePreview> {
  return callJson<FootageRestorePreview>(admin, "mcp_preview_footage_restore", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyFootageRestore(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<FootageRestoreSaved> {
  return callJson<FootageRestoreSaved>(admin, "mcp_apply_footage_restore", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

const CATALOG_MEDIA_BUCKET = "catalog-media";

/**
 * Bytes of one scene thumbnail (a 240 px wide jpg the Agent uploads at scan time). Only paths under the active
 * organization's thumbs folder are served; anything else is refused before storage is touched.
 */
export async function downloadFootageThumb(admin: SupabaseClient, ctx: Session, storagePath: string): Promise<Uint8Array> {
  const prefix = `${ctx.organizationId}/thumbs/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..") || !/\.jpe?g$/i.test(storagePath)) {
    throw new Error("forbidden");
  }
  const { data, error } = await admin.storage.from(CATALOG_MEDIA_BUCKET).download(storagePath);
  if (error || !data) throw new Error("not_found");
  return new Uint8Array(await data.arrayBuffer());
}
