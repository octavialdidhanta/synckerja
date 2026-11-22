import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;
export const CATALOG_MEDIA_BUCKET = "catalog-media";
const SIGNED_TTL_SECONDS = 60 * 60 * 6;

// The catalog and footage tables are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseQuery = any;

/** Reads every row of one org-scoped table, 1000 rows per request. */
export async function readAll<T>(
  client: SupabaseClient,
  table: string,
  columns: string,
  orgId: string,
  extra?: (q: LooseQuery) => LooseQuery,
): Promise<T[]> {
  const db = client as LooseQuery;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns).eq("organization_id", orgId).order("id").range(from, from + PAGE - 1);
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Signed URLs for private catalog-media objects (thumbnails and photos), keyed by storage path. */
export async function signCatalogMedia(client: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];
  const out: Record<string, string> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 200) chunks.push(unique.slice(i, i + 200));
  // One chunk at a time keeps the auth lock and the Micro database calm.
  for (const chunk of chunks) {
    const { data, error } = await client.storage.from(CATALOG_MEDIA_BUCKET).createSignedUrls(chunk, SIGNED_TTL_SECONDS);
    if (error) continue;
    for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
