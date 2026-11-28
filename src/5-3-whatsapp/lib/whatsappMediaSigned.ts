/**
 * whatsapp-media is going private (Storage P1). Messages keep the stored link (public or signed) as an identifier;
 * the inbox swaps it for a fresh signed link before rendering. Links from other hosts (Meta CDN, templates) stay as they are.
 */
import { supabase } from '@/shared/lib/supabaseClient';

export const WHATSAPP_MEDIA_BUCKET = 'whatsapp-media';

/** Signed links last 6 hours; one is reused until less than 1 hour is left, so images do not reload on every refetch. */
const SIGN_SECONDS = 6 * 60 * 60;
const REUSE_MIN_MS = 60 * 60 * 1000;
/** Outbound media: Meta downloads the file from this link when the message is sent. */
export const OUTBOUND_SIGN_SECONDS = 24 * 60 * 60;

const MARKER = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/whatsapp-media\/([^?#]+)/;

/** Storage path inside whatsapp-media from a stored link (public or signed); null for anything else. */
export function whatsappMediaPath(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url) return null;
  const hit = MARKER.exec(url);
  if (!hit) return null;
  try {
    const path = hit[1]
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
    return path && !path.includes('..') ? path : null;
  } catch {
    return null;
  }
}

type Signer = (paths: string[], seconds: number) => Promise<Array<{ path: string | null; signedUrl: string | null }>>;

const defaultSigner: Signer = async (paths, seconds) => {
  const { data, error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).createSignedUrls(paths, seconds);
  if (error || !data) return [];
  return data.map((row) => ({ path: row.path ?? null, signedUrl: row.signedUrl ?? null }));
};

const cache = new Map<string, { url: string; expiresAt: number }>();

/** Test hook: forget cached links. */
export function clearWhatsAppMediaCache(): void {
  cache.clear();
}

/**
 * Replace media_url with a signed link for every row whose media lives in whatsapp-media.
 * On any failure the row keeps its stored link (still works while the bucket is public).
 */
export async function signWhatsAppMediaRows<T extends { media_url?: string | null }>(
  rows: T[],
  signer: Signer = defaultSigner,
  now: () => number = Date.now,
): Promise<T[]> {
  const pathOf = new Map<T, string>();
  const missing = new Set<string>();
  for (const row of rows) {
    const path = whatsappMediaPath(row.media_url);
    if (!path) continue;
    pathOf.set(row, path);
    const cached = cache.get(path);
    if (!cached || cached.expiresAt - now() < REUSE_MIN_MS) missing.add(path);
  }
  if (missing.size > 0) {
    try {
      const signed = await signer([...missing], SIGN_SECONDS);
      const expiresAt = now() + SIGN_SECONDS * 1000;
      for (const item of signed) {
        if (item.path && item.signedUrl) cache.set(item.path, { url: item.signedUrl, expiresAt });
      }
    } catch {
      // Keep stored links.
    }
  }
  if (pathOf.size === 0) return rows;
  return rows.map((row) => {
    const path = pathOf.get(row);
    const url = path ? cache.get(path)?.url : undefined;
    return url ? { ...row, media_url: url } : row;
  });
}

/** One signed link for a path just uploaded from the Office (preview and the link Meta downloads). */
export async function signWhatsAppMediaPath(path: string, seconds: number): Promise<string | null> {
  const { data, error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
