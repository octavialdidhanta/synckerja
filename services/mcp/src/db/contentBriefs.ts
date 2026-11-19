import type { SupabaseClient } from "@supabase/supabase-js";
import type { BriefEditState, BriefUpdateWrite } from "../tools/content/briefsUpdate";
import {
  buildBriefConcept,
  buildBriefMarkdown,
  type BriefAssetInput,
  type BriefSequenceInput,
} from "../tools/content/briefMarkdown";
import { parseStoredBrief, type BriefStoryboard } from "../tools/content/briefRead";
import { BRIEF_HOW_TO_READ } from "../tools/content/briefsGet";
import { listStoryboardShots, listVoClipRows } from "./briefVoice";
import { narrationSource, voiceClipStale } from "../tools/content/voiceStale";
import { clipBelongsToShot } from "../../../../src/6-1-dashboard/modal/briefShotMatch";

type Session = { userId: string; organizationId: string };

export type ContentCatalogRow = {
  kind: string;
  id: string;
  name: string;
  service_id: string | null;
  sub_service_id: string | null;
};

export type ContentBriefRecord = {
  id: string;
  title: string;
  content_type_name: string | null;
  service_name: string | null;
  sub_service_name: string | null;
  feature_name: string | null;
  shot_count: number;
};

export type ContentBriefWrite = {
  title: string;
  postDate: string | null;
  contentTypeId: string;
  serviceId: string | null;
  subServiceId: string | null;
  featureId: string | null;
  postAspect: "4:5" | "1:1" | null;
  voiceOver: string | null;
  characters: BriefAssetInput[];
  locations: BriefAssetInput[];
  properties: BriefAssetInput[];
  caption: string | null;
  sequences: BriefSequenceInput[];
};

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return asRows<T>(data);
}

async function callRpcOne<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const rows = await callRpc<T>(admin, fn, args);
  const row = rows[0];
  if (!row) throw new Error("not_found");
  return row;
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export function listContentCatalog(admin: SupabaseClient, ctx: Session): Promise<ContentCatalogRow[]> {
  return callRpc<ContentCatalogRow>(admin, "mcp_list_content_catalog", sessionArgs(ctx));
}

export async function createContentBrief(
  admin: SupabaseClient,
  ctx: Session,
  input: ContentBriefWrite,
): Promise<ContentBriefRecord> {
  const catalog = await listContentCatalog(admin, ctx);
  const typeName = catalog.find((row) => row.kind === "type" && row.id === input.contentTypeId)?.name ?? "";
  const caption = input.caption?.trim() ? input.caption.trim() : null;
  if (caption && caption.length > 2200) throw new Error("invalid_input");
  return callRpcOne<ContentBriefRecord>(admin, "mcp_create_content_brief", {
    ...sessionArgs(ctx),
    p_title: input.title,
    p_post_date: input.postDate,
    p_content_type_id: input.contentTypeId,
    p_service_id: input.serviceId,
    p_sub_service_id: input.subServiceId,
    p_feature_id: input.featureId,
    p_brief: buildBriefMarkdown(input.sequences),
    p_concept: buildBriefConcept(
      {
        voiceOver: input.voiceOver,
        postAspect: input.postAspect,
        characters: input.characters,
        locations: input.locations,
        properties: input.properties,
      },
      typeName,
    ),
    p_caption: caption,
    p_post_aspect: input.postAspect,
  });
}

type BriefAsset = { handle: string; description: string };

type ContentBriefStored = {
  id: string;
  title: string;
  status: string | null;
  approved: boolean | null;
  production_status: string | null;
  post_date: string | null;
  updated_at: string | null;
  content_type_name: string | null;
  service_name: string | null;
  sub_service_name: string | null;
  feature_name: string | null;
  pillar_name: string | null;
  pic_name: string | null;
  brief: string | null;
  concept: {
    voice_over?: string | null;
    post_aspect?: string | null;
    characters?: BriefAsset[];
    locations?: BriefAsset[];
    properties?: BriefAsset[];
  } | null;
  concept_text: string | null;
  caption: string | null;
  has_drive_file: boolean | null;
  published: boolean | null;
  version_no?: number | null;
};

export type ContentBriefDetail = {
  id: string;
  title: string;
  status: string | null;
  approved: boolean;
  production_status: string | null;
  post_date: string | null;
  updated_at: string | null;
  content_type: string | null;
  category: string | null;
  subcategory: string | null;
  feature: string | null;
  pillar: string | null;
  pic_name: string | null;
  storyboard: BriefStoryboard | null;
  notes: string | null;
  voice_over: string | null;
  post_aspect: string | null;
  characters: BriefAsset[];
  locations: BriefAsset[];
  properties: BriefAsset[];
  concept_text: string | null;
  caption: string | null;
  has_drive_file: boolean;
  published: boolean;
  version_no: number;
  how_to_read: string;
};

function briefRpcError(message: string): Error {
  if (message.includes("not_found")) return new Error("not_found");
  if (message.includes("not_a_member") || message.includes("forbidden")) return new Error("forbidden");
  if (message.includes("invalid_input")) return new Error("invalid_input");
  return new Error("request_failed");
}

function assets(value: unknown): BriefAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const handle = typeof row.handle === "string" ? row.handle.trim() : "";
    const description = typeof row.description === "string" ? row.description.trim() : "";
    if (!handle && !description) return [];
    return [{ handle, description }];
  });
}

export function toContentBriefDetail(row: ContentBriefStored): ContentBriefDetail {
  const { storyboard, notes } = parseStoredBrief(row.brief);
  const concept = row.concept ?? {};
  return {
    id: row.id,
    title: row.title,
    status: row.status ?? null,
    approved: row.approved === true,
    production_status: row.production_status ?? null,
    post_date: row.post_date ?? null,
    updated_at: row.updated_at ?? null,
    content_type: row.content_type_name ?? null,
    category: row.service_name ?? null,
    subcategory: row.sub_service_name ?? null,
    feature: row.feature_name ?? null,
    pillar: row.pillar_name ?? null,
    pic_name: row.pic_name ?? null,
    storyboard,
    notes,
    voice_over: concept.voice_over?.trim() || null,
    post_aspect: concept.post_aspect?.trim() || null,
    characters: assets(concept.characters),
    locations: assets(concept.locations),
    properties: assets(concept.properties),
    concept_text: row.concept_text ?? null,
    caption: row.caption?.trim() || null,
    has_drive_file: row.has_drive_file === true,
    published: row.published === true,
    version_no: typeof row.version_no === "number" ? row.version_no : 0,
    how_to_read: BRIEF_HOW_TO_READ,
  };
}

export async function getContentBrief(
  admin: SupabaseClient,
  ctx: Session,
  id: string,
): Promise<ContentBriefDetail> {
  const { data, error } = await admin.rpc("mcp_get_content_brief", { ...sessionArgs(ctx), p_id: id });
  if (error) throw briefRpcError(error.message ?? "");
  const row = asRows<ContentBriefStored>(data)[0];
  if (!row) throw new Error("not_found");
  const detail = toContentBriefDetail(row);
  try {
    const shots = await listStoryboardShots(admin, id).catch(() => []);
    const clips = detail.storyboard ? await listVoClipRows(admin, ctx, id) : [];
    if (!detail.storyboard) return detail;
    let index = 0;
    for (const sequence of detail.storyboard.sequences) {
      for (const shot of sequence.shots) {
        const shotId = shots.find((item) => item.row_index === index)?.id ?? null;
        if (shotId) shot.shot_id = shotId;
        const matches = clips
          .filter((clip) => clipBelongsToShot(clip, index, shotId))
          .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
        if (clips.length > 0) {
          const spoken = matches[0]?.spoken_text?.trim() || null;
          const hasVoice = matches.length > 0;
          shot.has_voice = hasVoice;
          shot.voice_stale = hasVoice && voiceClipStale(spoken, narrationSource(shot.vo, detail.voice_over));
        }
        index += 1;
      }
    }
  } catch {
    // Voice list is additive; brief text still returns if the clips RPC is unavailable.
  }
  return detail;
}

function briefUpdateError(message: string): Error {
  if (message.includes("brief_version_conflict")) return new Error("brief_version_conflict");
  if (message.includes("brief_version_required")) return new Error("brief_version_required");
  if (message.includes("brief_field_forbidden")) return new Error("brief_field_forbidden");
  if (message.includes("brief_edit_locked")) return new Error("brief_edit_locked");
  if (message.includes("confirmation_used")) return new Error("confirmation_used");
  if (message.includes("not_found") || message.includes("Plan not found")) return new Error("not_found");
  if (message.includes("not_a_member") || message.includes("Not allowed")) return new Error("forbidden");
  if (message.includes("invalid_input")) return new Error("invalid_input");
  return new Error("request_failed");
}

function asShots(value: unknown): BriefEditState["shots"] {
  const rows = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { id?: unknown; row_index?: unknown };
    if (typeof item.id !== "string" || typeof item.row_index !== "number") return [];
    return [{ id: item.id, rowIndex: item.row_index }];
  });
}

type BriefEditStateRow = {
  version_no: number | null;
  status: string | null;
  approved: boolean | null;
  revision_locked: boolean | null;
  can_storyboard: boolean | null;
  can_concept: boolean | null;
  can_caption: boolean | null;
  can_link: boolean | null;
  brief: string | null;
  concept: string | null;
  caption: string | null;
  link_reference: string | null;
  shots: unknown;
};

export async function readContentBriefForUpdate(
  admin: SupabaseClient,
  ctx: Session,
  planId: string,
): Promise<BriefEditState> {
  const { data, error } = await admin.rpc("mcp_read_content_brief_for_update", {
    ...sessionArgs(ctx),
    p_plan_id: planId,
  });
  if (error) throw briefUpdateError(error.message ?? "");
  const row = asRows<BriefEditStateRow>(data)[0];
  if (!row) throw new Error("not_found");
  return {
    versionNo: typeof row.version_no === "number" ? row.version_no : 0,
    status: row.status ?? null,
    approved: row.approved === true,
    revisionLocked: row.revision_locked === true,
    canStoryboard: row.can_storyboard === true,
    canConcept: row.can_concept === true,
    canCaption: row.can_caption === true,
    brief: row.brief ?? "",
    concept: row.concept ?? "",
    caption: row.caption ?? "",
    link: row.link_reference ?? "",
    shots: asShots(row.shots),
  };
}

export async function confirmContentBrief(
  admin: SupabaseClient,
  ctx: Session,
  write: BriefUpdateWrite,
  confirmId: string,
): Promise<{ id: string; version_no: number; status: string | null; approved: boolean }> {
  const { data, error } = await admin.rpc("mcp_confirm_content_brief", {
    ...sessionArgs(ctx),
    p_plan_id: write.planId,
    p_base_version: write.baseVersion,
    p_confirm_id: confirmId,
    p_brief: write.brief,
    p_concept: write.concept,
    p_caption: write.caption,
    p_link: write.link,
  });
  if (error) throw briefUpdateError(error.message ?? "");
  const row = asRows<{ id: string; version_no: number | null; status: string | null; approved: boolean | null }>(data)[0];
  if (!row) throw new Error("not_found");
  return {
    id: row.id,
    version_no: typeof row.version_no === "number" ? row.version_no : 0,
    status: row.status ?? null,
    approved: row.approved === true,
  };
}
