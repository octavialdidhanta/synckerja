import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProductLook, type LookSubcategory } from "../../../../supabase/functions/_shared/describeCatalogProduct";

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
    download_url?: string | null;
  }>;
  /**
   * The one appearance photo. Null when the product has no Item Library or subcategory photo;
   * the reference download_url is the appearance photo in that case.
   */
  look?: { source: "item" | "subcategory"; download_url: string | null } | null;
  /** False when the appearance photo cannot be opened. Claude must not invent the plating. */
  photo_visible?: boolean;
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

const CATALOG_MEDIA_BUCKET = "catalog-media";
const ITEM_PHOTO_BUCKET = "catalog-product-photos";
const SUBCATEGORY_PHOTO_BUCKET = "sub-service-photos";
const PHOTO_URL_SECONDS = 15 * 60;

export type CatalogLookSign = {
  source: "item" | "subcategory";
  bucket: typeof ITEM_PHOTO_BUCKET | typeof SUBCATEGORY_PHOTO_BUCKET;
  path: string;
};

async function signPath(admin: SupabaseClient, bucket: string, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(bucket).createSignedUrls([path], PHOTO_URL_SECONDS);
  const row = (data ?? []).find((item) => item.path === path && item.signedUrl);
  return row?.signedUrl ?? null;
}

/** Signed read URL for the one appearance photo. A source photo that cannot be opened does not fall back to the reference copy. */
export async function withCatalogPhotoUrls(
  admin: SupabaseClient,
  product: CatalogProduct,
  look: CatalogLookSign | null = null,
): Promise<CatalogProduct> {
  if (look) {
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await signPath(admin, look.bucket, look.path);
    } catch {
      downloadUrl = null;
    }
    return {
      ...product,
      photos: product.photos.map((photo) => ({ ...photo, download_url: null })),
      look: { source: look.source, download_url: downloadUrl },
      photo_visible: Boolean(downloadUrl),
    };
  }

  const paths = [...new Set(product.photos.map((photo) => photo.storage_path).filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data } = await admin.storage.from(CATALOG_MEDIA_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS);
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
      }
    } catch {
      // The text is still useful when storage signing fails.
    }
  }
  const photos = product.photos.map((photo) => ({
    ...photo,
    download_url: photo.storage_path ? (urls.get(photo.storage_path) ?? null) : null,
  }));
  return { ...product, photos, look: null, photo_visible: photos.some((photo) => Boolean(photo.download_url)) };
}

type MenuLookRow = {
  name: string;
  default_price_id: string | null;
  feature_id: string | null;
  sub_service_id: string | null;
};

/** The appearance photo for this product, or null when Claude should open the reference photos. */
export async function readCatalogLook(
  admin: SupabaseClient,
  ctx: Session,
  product: CatalogProduct,
): Promise<CatalogLookSign | null> {
  const { data: menu, error } = await admin
    .from("catalog_menus")
    .select("name,default_price_id,feature_id,sub_service_id")
    .eq("organization_id", ctx.organizationId)
    .eq("external_id", product.id)
    .maybeSingle();
  if (error || !menu) return null;
  const row = menu as MenuLookRow;

  let itemPath: string | null = null;
  let linkedSubcategoryPath: string | null = null;
  let items: Array<{ name: string }> = [];
  let subcategories: LookSubcategory[] = [];
  if (row.default_price_id) {
    const price = await admin
      .from("default_prices")
      .select("photo_path")
      .eq("id", row.default_price_id)
      .eq("organization_id", ctx.organizationId)
      .eq("kind", "product")
      .maybeSingle();
    if (!price.error) itemPath = (price.data?.photo_path as string | null) ?? null;
  } else if (row.sub_service_id) {
    const sub = await admin
      .from("sub_services")
      .select("image_path")
      .eq("id", row.sub_service_id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!sub.error) linkedSubcategoryPath = (sub.data?.image_path as string | null) ?? null;
  } else if (!row.feature_id) {
    const [prices, subs] = await Promise.all([
      admin.from("default_prices").select("name").eq("organization_id", ctx.organizationId).eq("kind", "product"),
      admin
        .from("sub_services")
        .select("name,image_path,catalog_product_id")
        .eq("organization_id", ctx.organizationId)
        .eq("is_active", true)
        .order("name"),
    ]);
    if (!prices.error && !subs.error) {
      items = ((prices.data ?? []) as Array<{ name: string | null }>).map((item) => ({ name: item.name ?? "" }));
      subcategories = ((subs.data ?? []) as Array<{ name: string | null; image_path: string | null; catalog_product_id: string | null }>).map((item) => ({
        name: item.name ?? "",
        imagePath: item.image_path,
        catalogProductId: item.catalog_product_id,
      }));
    }
  }

  const choice = resolveProductLook({
    menuName: row.name,
    defaultPriceId: row.default_price_id,
    featureId: row.feature_id,
    subServiceId: row.sub_service_id,
    itemPath,
    linkedSubcategoryPath,
    items,
    subcategories,
    catalogPaths: product.photos.map((photo) => photo.storage_path),
  });
  if (!choice || choice.bucket === CATALOG_MEDIA_BUCKET) return null;
  return {
    source: choice.bucket === ITEM_PHOTO_BUCKET ? "item" : "subcategory",
    bucket: choice.bucket,
    path: choice.path,
  };
}

export async function presentCatalogProduct(
  admin: SupabaseClient,
  ctx: Session,
  product: CatalogProduct,
): Promise<CatalogProduct> {
  const look = await readCatalogLook(admin, ctx, product);
  return withCatalogPhotoUrls(admin, product, look);
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

/** One stored photo the AI may look at: where it lives and how to label it. */
export type CatalogPhotoSource = {
  bucket: string;
  path: string;
  label: string;
  file_path: string | null;
  kind: "look_item" | "look_subcategory" | "reference" | "location";
  areas?: string[];
  description?: string | null;
};

export type CatalogPhotoSet = { id: string; name: string; sources: CatalogPhotoSource[]; without_file: string[] };

/** The product's appearance photo (the same one catalog.product.get signs), or its reference photos when it has no look photo. */
export async function catalogProductPhotoSources(
  admin: SupabaseClient,
  ctx: Session,
  address: CatalogAddress,
): Promise<CatalogPhotoSet> {
  const product = await getCatalogProduct(admin, ctx, address);
  const look = await readCatalogLook(admin, ctx, product);
  if (look) {
    return {
      id: product.id,
      name: product.name,
      sources: [
        {
          bucket: look.bucket,
          path: look.path,
          label: product.name,
          file_path: null,
          kind: look.source === "item" ? "look_item" : "look_subcategory",
        },
      ],
      without_file: [],
    };
  }
  return {
    id: product.id,
    name: product.name,
    sources: product.photos
      .filter((photo) => Boolean(photo.storage_path))
      .map((photo) => ({
        bucket: CATALOG_MEDIA_BUCKET,
        path: photo.storage_path!,
        label: photo.label,
        file_path: photo.file_path,
        kind: "reference" as const,
      })),
    without_file: product.photos.filter((photo) => !photo.storage_path).map((photo) => photo.label || photo.file_path),
  };
}

export async function catalogLocationPhotoSources(
  admin: SupabaseClient,
  ctx: Session,
  address: CatalogAddress,
): Promise<CatalogPhotoSet> {
  const location = await getCatalogLocation(admin, ctx, address);
  return {
    id: location.id,
    name: location.name,
    sources: location.photos
      .filter((photo) => Boolean(photo.storage_path))
      .map((photo) => ({
        bucket: CATALOG_MEDIA_BUCKET,
        path: photo.storage_path!,
        label: photo.label,
        file_path: photo.file_path,
        kind: "location" as const,
        areas: photo.areas ?? [],
        description: photo.description,
      })),
    without_file: location.photos.filter((photo) => !photo.storage_path).map((photo) => photo.label || photo.file_path),
  };
}

const PHOTO_BUCKETS = new Set<string>([CATALOG_MEDIA_BUCKET, ITEM_PHOTO_BUCKET, SUBCATEGORY_PHOTO_BUCKET]);
/** Larger files are fetched again through Storage image resizing so the picture stays within MCP client limits. */
export const CATALOG_PHOTO_MAX_BYTES = 4_000_000;

/**
 * Bytes of one catalog photo. Only the three catalog photo buckets and paths under the active organization's folder
 * are served; anything else is refused before storage is touched.
 */
export async function downloadCatalogPhoto(
  admin: SupabaseClient,
  ctx: Session,
  bucket: string,
  path: string,
): Promise<Uint8Array> {
  if (!PHOTO_BUCKETS.has(bucket) || !path.startsWith(`${ctx.organizationId}/`) || path.includes("..") || !/\.(png|jpe?g|webp|gif)$/i.test(path)) {
    throw new Error("forbidden");
  }
  const original = await admin.storage.from(bucket).download(path);
  if (original.error || !original.data) throw new Error("not_found");
  const bytes = new Uint8Array(await original.data.arrayBuffer());
  if (bytes.byteLength <= CATALOG_PHOTO_MAX_BYTES) return bytes;
  const smaller = await admin.storage
    .from(bucket)
    .download(path, { transform: { width: 1600, height: 1600, resize: "contain", quality: 75 } });
  if (smaller.error || !smaller.data) throw new Error("too_large");
  const resized = new Uint8Array(await smaller.data.arrayBuffer());
  if (resized.byteLength > CATALOG_PHOTO_MAX_BYTES) throw new Error("too_large");
  return resized;
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

// ---------------------------------------------------------------------------
// Library writes: style box, reference document, shot list job (preview → save).
// ---------------------------------------------------------------------------

export type CatalogStyleUpdateInput = { field_key: string; body: string; mode?: "replace" | "append" };

export type CatalogStyleUpdatePreview = {
  field_key: string;
  mode: "replace" | "append";
  is_new: boolean;
  before: string | null;
  after: string;
  preview_id: string;
  expires_at: string;
};

export type CatalogStyleUpdateSaved = {
  saved: boolean;
  field_key: string;
  is_new: boolean;
  before: string | null;
  after: string;
};

export type CatalogDocumentUpsertInput = { external_id: string; document: Record<string, unknown> };

export type CatalogReferenceUpsertPreview = {
  external_id: string;
  is_new: boolean;
  before: { judul: string | null; beats: number; mg: number } | null;
  after: { judul: string | null; beats: number; mg: number };
  changed_keys: string[];
  images_kept: number;
  images_unlinked: string[];
  preview_id: string;
  expires_at: string;
};

export type CatalogReferenceUpsertSaved = {
  saved: boolean;
  external_id: string;
  is_new: boolean;
  beats: number;
  mg: number;
  images_kept: number;
  images_unlinked: string[];
};

export type CatalogShotsDiff = { added: string[]; removed: string[]; changed: string[] };

export type CatalogShotJobUpsertPreview = {
  external_id: string;
  is_new: boolean;
  before: { judul: string | null; arsip: boolean; shots: number } | null;
  after: { judul: string | null; arsip: boolean; shots: number };
  shots_diff: CatalogShotsDiff;
  preview_id: string;
  expires_at: string;
};

export type CatalogShotJobUpsertSaved = {
  saved: boolean;
  external_id: string;
  is_new: boolean;
  shots: number;
  shots_diff: CatalogShotsDiff;
};

export async function previewCatalogStyleUpdate(
  admin: SupabaseClient,
  ctx: Session,
  input: CatalogStyleUpdateInput,
): Promise<CatalogStyleUpdatePreview> {
  return callJson<CatalogStyleUpdatePreview>(admin, "mcp_preview_catalog_style_update", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyCatalogStyleUpdate(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<CatalogStyleUpdateSaved> {
  return callJson<CatalogStyleUpdateSaved>(admin, "mcp_apply_catalog_style_update", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewCatalogReferenceUpsert(
  admin: SupabaseClient,
  ctx: Session,
  input: CatalogDocumentUpsertInput,
): Promise<CatalogReferenceUpsertPreview> {
  return callJson<CatalogReferenceUpsertPreview>(admin, "mcp_preview_catalog_reference_upsert", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyCatalogReferenceUpsert(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<CatalogReferenceUpsertSaved> {
  return callJson<CatalogReferenceUpsertSaved>(admin, "mcp_apply_catalog_reference_upsert", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function previewCatalogShotJobUpsert(
  admin: SupabaseClient,
  ctx: Session,
  input: CatalogDocumentUpsertInput,
): Promise<CatalogShotJobUpsertPreview> {
  return callJson<CatalogShotJobUpsertPreview>(admin, "mcp_preview_catalog_shotlist_upsert", {
    ...sessionArgs(ctx),
    p_input: input,
  });
}

export async function applyCatalogShotJobUpsert(
  admin: SupabaseClient,
  ctx: Session,
  previewId: string,
): Promise<CatalogShotJobUpsertSaved> {
  return callJson<CatalogShotJobUpsertSaved>(admin, "mcp_apply_catalog_shotlist_upsert", {
    ...sessionArgs(ctx),
    p_preview_id: previewId,
  });
}

export async function listIndustryTemplates(admin: SupabaseClient, ctx: Session): Promise<unknown> {
  return callJson(admin, "mcp_list_industry_templates", sessionArgs(ctx));
}

export async function getCatalogSettings(admin: SupabaseClient, ctx: Session): Promise<unknown> {
  return callJson(admin, "mcp_get_catalog_settings", sessionArgs(ctx));
}

export async function applyIndustryTemplate(
  admin: SupabaseClient,
  ctx: Session,
  code: string,
): Promise<unknown> {
  return callJson(admin, "mcp_apply_industry_template", {
    ...sessionArgs(ctx),
    p_code: code,
  });
}

export async function loadProductFieldMenu(
  admin: SupabaseClient,
  ctx: Session,
  address: CatalogAddress,
): Promise<{ menuId: string; name: string; settings: unknown; current: CatalogProduct["fields"] }> {
  const product = await getCatalogProduct(admin, ctx, address);
  const settings = await getCatalogSettings(admin, ctx);
  const { data, error } = await admin
    .from("catalog_menus")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("external_id", product.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("not_found");
  return { menuId: data.id as string, name: product.name, settings, current: product.fields };
}

export async function applyCatalogProductFields(
  admin: SupabaseClient,
  ctx: Session,
  write: { menuId: string; fields: { key: string; body: string }[] },
  confirmId: string,
  allowed: { key: string; position: number }[],
): Promise<{ saved: boolean; id: string }> {
  for (const field of write.fields) {
    const body = field.body.trim();
    if (!allowed.some((item) => item.key === field.key)) throw new Error("field_forbidden");
    if (!body || body.length > 4000) throw new Error("confirmation_invalid");
  }
  const { data: menu, error: menuError } = await admin
    .from("catalog_menus")
    .select("id")
    .eq("id", write.menuId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (menuError) throw new Error(menuError.message);
  if (!menu) throw new Error("not_found");

  const { data: existing, error: readError } = await admin
    .from("catalog_menu_fields")
    .select("field_key,position")
    .eq("organization_id", ctx.organizationId)
    .eq("menu_id", write.menuId);
  if (readError) throw new Error(readError.message);
  const rows = (existing ?? []) as { field_key: string; position: number }[];
  const used = new Set(rows.map((row) => row.position));
  let cursor = used.size ? Math.max(...rows.map((row) => row.position)) + 1 : 0;
  const take = (preferred: number) => {
    if (!used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    while (used.has(cursor)) cursor += 1;
    used.add(cursor);
    const position = cursor;
    cursor += 1;
    return position;
  };

  for (const field of write.fields) {
    const body = field.body.trim();
    const current = rows.find((row) => row.field_key === field.key);
    if (current) {
      const { error } = await admin
        .from("catalog_menu_fields")
        .update({ body })
        .eq("organization_id", ctx.organizationId)
        .eq("menu_id", write.menuId)
        .eq("field_key", field.key);
      if (error) throw new Error(error.message);
      continue;
    }
    const preferred = allowed.find((item) => item.key === field.key)?.position ?? cursor;
    const { error } = await admin.from("catalog_menu_fields").insert({
      organization_id: ctx.organizationId,
      menu_id: write.menuId,
      field_key: field.key,
      body,
      position: take(preferred),
    });
    if (error) throw new Error(error.message);
  }

  const { error: confirmError } = await admin.from("mcp_tool_confirmations").insert({
    id: confirmId,
    organization_id: ctx.organizationId,
    user_id: ctx.userId,
    tool: "catalog.product.fields.update",
  });
  if (confirmError) {
    if (confirmError.code === "23505" || confirmError.message.includes("mcp_tool_confirmations_pkey")) {
      throw new Error("confirmation_used");
    }
    throw new Error(confirmError.message);
  }
  return { saved: true, id: write.menuId };
}

/** Industry template of the organization and that template's claim words (brief claim check). */
export async function getClaimWords(admin: SupabaseClient, ctx: Session): Promise<{ industry: string | null; claim_words: string[] }> {
  const row = await callJson<{ industry: string | null; claim_words: unknown }>(admin, "mcp_get_claim_words", sessionArgs(ctx));
  return {
    industry: row.industry ?? null,
    claim_words: Array.isArray(row.claim_words) ? row.claim_words.filter((w): w is string => typeof w === "string") : [],
  };
}
