import { supabase, SUPABASE_URL } from "@/shared/lib/supabaseClient";

/**
 * Short-lived, file-scoped tokens for Drive media/thumbnail URLs.
 * <video>/<img> cannot send headers, so we ask google-drive-media-token (session in the
 * Authorization header) for a `media_token` and put THAT in the URL — never the session JWT.
 */

type Entry = { token: string; expiresAt: number };

const REFRESH_MARGIN_SECONDS = 10 * 60;
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

function stillFresh(entry: Entry | undefined, nowSeconds: number): entry is Entry {
  return !!entry && entry.expiresAt - REFRESH_MARGIN_SECONDS > nowSeconds;
}

/** Returns a media_token for `fileId`, or null when not signed in / the server refuses. */
export async function getDriveMediaToken(fileId: string): Promise<string | null> {
  if (!fileId) return null;
  const cached = cache.get(fileId);
  if (stillFresh(cached, Date.now() / 1000)) return cached.token;

  const pending = inflight.get(fileId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<{
        media_token?: string;
        expires_at?: number;
      }>("google-drive-media-token", { body: { file_id: fileId } });
      if (error || !data?.media_token || typeof data.expires_at !== "number") return null;
      cache.set(fileId, { token: data.media_token, expiresAt: data.expires_at });
      return data.media_token;
    } catch {
      return null;
    } finally {
      inflight.delete(fileId);
    }
  })();
  inflight.set(fileId, request);
  return request;
}

/** Forget cached tokens (e.g. on sign-out). */
export function clearDriveMediaTokens(): void {
  cache.clear();
  inflight.clear();
}

export function buildDriveMediaUrl(
  kind: "google-drive-file-media" | "google-drive-file-thumbnail",
  fileId: string,
  mediaToken: string,
): string {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${kind}`);
  url.searchParams.set("file_id", fileId);
  url.searchParams.set("media_token", mediaToken);
  return url.toString();
}
