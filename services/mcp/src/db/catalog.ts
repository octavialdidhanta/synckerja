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
  photos: Array<{ file_path: string; label: string; ref: string | null; position: number }>;
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
