import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBriefConcept,
  buildBriefMarkdown,
  type BriefAssetInput,
  type BriefSequenceInput,
} from "../tools/content/briefMarkdown";
import { parseStoredBrief, type BriefStoryboard } from "../tools/content/briefRead";
import { BRIEF_HOW_TO_READ } from "../tools/content/briefsGet";

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
  return toContentBriefDetail(row);
}
