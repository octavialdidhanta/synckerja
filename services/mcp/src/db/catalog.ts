import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

export type CatalogProductSummary = {
  id: string;
  name: string;
  aliases: string[];
  photo_count: number;
  waiting: boolean;
};

export type CatalogProductList = {
  total: number;
  products: CatalogProductSummary[];
};

export type CatalogProduct = {
  id: string;
  name: string;
  aliases: string[];
  waiting: boolean;
  product_knowledge_id: string | null;
  fields: Array<{ key: string; body: string; position: number }>;
  photos: Array<{
    file_path: string;
    storage_path: string | null;
    label: string;
    ref: string | null;
    position: number;
  }>;
};

export type CatalogLocationSummary = {
  id: string;
  name: string;
  photo_count: number;
  waiting: boolean;
};

export type CatalogLocationList = {
  total: number;
  locations: CatalogLocationSummary[];
};

export type CatalogLocation = {
  id: string;
  name: string;
  waiting: boolean;
  photos: Array<{
    file_path: string;
    storage_path: string | null;
    label: string;
    ref: string | null;
    description: string | null;
    areas: string[];
    position: number;
  }>;
  sections: Array<{ title: string; body: string; areas: string[]; position: number }>;
  areas: Array<{ name: string; body: string; position: number }>;
};

export type CatalogAddress = {
  id?: string;
  name?: string;
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

export async function listCatalogProducts(admin: SupabaseClient, ctx: Session): Promise<CatalogProductList> {
  const row = await callJson<CatalogProductList>(admin, "mcp_list_catalog_products", sessionArgs(ctx));
  return {
    total: Number(row.total ?? 0),
    products: Array.isArray(row.products) ? row.products : [],
  };
}

export async function getCatalogProduct(
  admin: SupabaseClient,
  ctx: Session,
  address: CatalogAddress,
): Promise<CatalogProduct> {
  const row = await callJson<CatalogProduct>(admin, "mcp_get_catalog_product", {
    ...sessionArgs(ctx),
    p_id: address.id ?? null,
    p_name: address.name ?? null,
  });
  return {
    ...row,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    fields: Array.isArray(row.fields) ? row.fields : [],
    photos: Array.isArray(row.photos) ? row.photos : [],
  };
}

export async function listCatalogLocations(admin: SupabaseClient, ctx: Session): Promise<CatalogLocationList> {
  const row = await callJson<CatalogLocationList>(admin, "mcp_list_catalog_locations", sessionArgs(ctx));
  return {
    total: Number(row.total ?? 0),
    locations: Array.isArray(row.locations) ? row.locations : [],
  };
}

export async function getCatalogLocation(
  admin: SupabaseClient,
  ctx: Session,
  address: CatalogAddress,
): Promise<CatalogLocation> {
  const row = await callJson<CatalogLocation>(admin, "mcp_get_catalog_location", {
    ...sessionArgs(ctx),
    p_id: address.id ?? null,
    p_name: address.name ?? null,
  });
  return {
    ...row,
    photos: Array.isArray(row.photos) ? row.photos : [],
    sections: Array.isArray(row.sections) ? row.sections : [],
    areas: Array.isArray(row.areas) ? row.areas : [],
  };
}

export type CatalogTextBlocks = Record<string, string>;

export type CatalogReferenceSummary = {
  id: string;
  title: string | null;
  file: string | null;
  creator: string | null;
  has_voice: boolean;
  beat_count: number;
  motion_count: number;
};

export type CatalogReferenceList = {
  total: number;
  references: CatalogReferenceSummary[];
};

export type CatalogShotJobSummary = {
  id: string;
  title: string | null;
  location_id: string | null;
  archived: boolean;
  shot_count: number;
};

export type CatalogShotJobList = {
  total: number;
  jobs: CatalogShotJobSummary[];
};

export async function getCatalogStyle(admin: SupabaseClient, ctx: Session): Promise<CatalogTextBlocks> {
  return callJson<CatalogTextBlocks>(admin, "mcp_get_catalog_style", sessionArgs(ctx));
}

export async function getCatalogPrompts(admin: SupabaseClient, ctx: Session): Promise<CatalogTextBlocks> {
  return callJson<CatalogTextBlocks>(admin, "mcp_get_catalog_prompts", sessionArgs(ctx));
}

export async function listCatalogReferences(admin: SupabaseClient, ctx: Session): Promise<CatalogReferenceList> {
  const row = await callJson<CatalogReferenceList>(admin, "mcp_list_catalog_references", sessionArgs(ctx));
  return {
    total: Number(row.total ?? 0),
    references: Array.isArray(row.references) ? row.references : [],
  };
}

export async function getCatalogReference(
  admin: SupabaseClient,
  ctx: Session,
  id: string,
): Promise<Record<string, unknown>> {
  return callJson<Record<string, unknown>>(admin, "mcp_get_catalog_reference", {
    ...sessionArgs(ctx),
    p_id: id,
  });
}

export async function listCatalogShotJobs(admin: SupabaseClient, ctx: Session): Promise<CatalogShotJobList> {
  const row = await callJson<CatalogShotJobList>(admin, "mcp_list_catalog_shot_jobs", sessionArgs(ctx));
  return {
    total: Number(row.total ?? 0),
    jobs: Array.isArray(row.jobs) ? row.jobs : [],
  };
}

export async function getCatalogShotJob(
  admin: SupabaseClient,
  ctx: Session,
  id: string,
): Promise<Record<string, unknown>> {
  return callJson<Record<string, unknown>>(admin, "mcp_get_catalog_shot_job", {
    ...sessionArgs(ctx),
    p_id: id,
  });
}

export type CatalogMediaDeleteInput =
  | { kind: "menu_photo" | "location_photo"; id: string; acknowledge_used?: boolean }
  | { kind: "reference_image"; external_id: string; storage_path: string; acknowledge_used?: boolean };

export type CatalogMediaRestoreInput =
  | { kind: "menu_photo" | "location_photo"; id: string }
  | { kind: "reference_image"; external_id: string; storage_path: string };

export type CatalogMediaDeletePreview = {
  kind: CatalogMediaDeleteInput["kind"];
  id?: string | null;
  external_id?: string | null;
  file_path?: string | null;
  storage_path?: string | null;
  label?: string | null;
  used?: boolean;
  usage_count?: number;
  usages?: unknown[];
  can_save?: boolean;
  preview_id?: string;
  expires_at?: string;
};

export type CatalogMediaDeleteSaved = {
  saved: boolean;
  kind: string;
  id?: string | null;
  external_id?: string | null;
  storage_path?: string | null;
  deleted_at: string;
  purge_after: string;
  storage_kept: boolean;
};

export type CatalogMediaRestorePreview = {
  kind: CatalogMediaRestoreInput["kind"];
  id?: string | null;
  external_id?: string | null;
  storage_path?: string | null;
  deleted_at: string;
  purge_after?: string | null;
  can_save?: boolean;
  reason?: string;
  preview_id?: string;
  expires_at?: string;
};

export type CatalogMediaRestoreSaved = {
  saved: boolean;
  kind: string;
  id?: string | null;
  external_id?: string | null;
  storage_path?: string | null;
  deleted_at: string | null;
};

export async function previewCatalogMediaDelete(
  admin: SupabaseClient,
  ctx: Session,
  input: CatalogMediaDeleteInput,
): Promise<CatalogMediaDeletePreview> {
  return callJson<CatalogMediaDeletePreview>(admin, "mcp_preview_catalog_media_delete", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyCatalogMediaDelete(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<CatalogMediaDeleteSaved> {
  return callJson<CatalogMediaDeleteSaved>(admin, "mcp_apply_catalog_media_delete", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewCatalogMediaRestore(
  admin: SupabaseClient,
  ctx: Session,
  input: CatalogMediaRestoreInput,
): Promise<CatalogMediaRestorePreview> {
  return callJson<CatalogMediaRestorePreview>(admin, "mcp_preview_catalog_media_restore", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyCatalogMediaRestore(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<CatalogMediaRestoreSaved> {
  return callJson<CatalogMediaRestoreSaved>(admin, "mcp_apply_catalog_media_restore", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}
