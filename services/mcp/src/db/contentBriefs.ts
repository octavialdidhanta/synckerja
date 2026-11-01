import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBriefConcept,
  buildBriefMarkdown,
  type BriefAssetInput,
  type BriefSequenceInput,
} from "../tools/content/briefMarkdown";

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
