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
  hijab: boolean;
  watermark_ui: boolean;
  lengkuas: boolean;
  meja_biru: boolean;
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
  limit?: number;
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
