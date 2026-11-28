/**
 * Signed links for private Storage buckets in the Office, with a small cache so the same object keeps the same
 * link across re-renders and refetches (images do not reload). Pure link parsing lives in storageLinks.ts.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { replaceStorageLinksInText, storagePathFromUrl, storagePathsInText } from "./storageLinks";

/** Signed links last 6 hours; one is reused until less than 1 hour is left. */
const SIGN_SECONDS = 6 * 60 * 60;
const REUSE_MIN_MS = 60 * 60 * 1000;

export type StorageSigner = (
  bucket: string,
  paths: string[],
  seconds: number,
) => Promise<Array<{ path: string | null; signedUrl: string | null }>>;

const defaultSigner: StorageSigner = async (bucket, paths, seconds) => {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds);
  if (error || !data) return [];
  return data.map((row) => ({ path: row.path ?? null, signedUrl: row.signedUrl ?? null }));
};

const cache = new Map<string, { url: string; expiresAt: number }>();
const key = (bucket: string, path: string) => `${bucket}\u0000${path}`;

/** Test hook. */
export function clearSignedStorageLinkCache(): void {
  cache.clear();
}

/** path → signed link for every path that could be signed; failures are left out (callers keep the stored link). */
export async function signStoragePaths(
  bucket: string,
  paths: string[],
  signer: StorageSigner = defaultSigner,
  now: () => number = Date.now,
): Promise<Map<string, string>> {
  const missing = paths.filter((path) => {
    const hit = cache.get(key(bucket, path));
    return !hit || hit.expiresAt - now() < REUSE_MIN_MS;
  });
  if (missing.length > 0) {
    try {
      const rows = await signer(bucket, [...new Set(missing)], SIGN_SECONDS);
      const expiresAt = now() + SIGN_SECONDS * 1000;
      for (const row of rows) {
        if (row.path && row.signedUrl) cache.set(key(bucket, row.path), { url: row.signedUrl, expiresAt });
      }
    } catch {
      // Keep stored links.
    }
  }
  const out = new Map<string, string>();
  for (const path of paths) {
    const hit = cache.get(key(bucket, path));
    if (hit) out.set(path, hit.url);
  }
  return out;
}

/** Text or HTML with every link of `bucket` swapped for a signed one. */
export async function signStorageLinksInText(
  bucket: string,
  text: string,
  signer?: StorageSigner,
  now?: () => number,
): Promise<string> {
  const paths = storagePathsInText(text, bucket);
  if (paths.length === 0) return text;
  const signed = await signStoragePaths(bucket, paths, signer, now);
  return replaceStorageLinksInText(text, bucket, signed);
}

/** One stored link → signed link (or the stored link when it is not in `bucket` or signing fails). */
export async function signStorageUrl(bucket: string, url: string): Promise<string> {
  const path = storagePathFromUrl(url, bucket);
  if (!path) return url;
  const signed = await signStoragePaths(bucket, [path]);
  return signed.get(path) ?? url;
}

/** React: `text` with links of `bucket` signed. Shows the stored text until signing finishes. */
export function useSignedStorageText(bucket: string, text: string | null | undefined): string | null | undefined {
  const [signed, setSigned] = useState<{ source: string; value: string } | null>(null);
  useEffect(() => {
    if (!text || storagePathsInText(text, bucket).length === 0) return;
    let cancelled = false;
    void signStorageLinksInText(bucket, text).then((value) => {
      if (!cancelled) setSigned({ source: text, value });
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, text]);
  return signed && signed.source === text ? signed.value : text;
}
