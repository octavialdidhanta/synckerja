import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { devLog } from "@/shared/lib/logger";
import { shouldReplaceDriveApiError } from "../utils/driveInvokeFriendlyError";

export type DriveFileThumbnailMeta = {
  thumbnailLink: string | null;
  fallbackThumbnailUrl: string | null;
  name: string | null;
  mimeType: string | null;
};

/**
 * Fetches Drive file metadata (thumbnail) via Edge Function using the user's stored Google tokens.
 */
export function useDriveFileThumbnailMeta(fileId: string | null): DriveFileThumbnailMeta & {
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<DriveFileThumbnailMeta>({
    thumbnailLink: null,
    fallbackThumbnailUrl: null,
    name: null,
    mimeType: null,
  });

  useEffect(() => {
    if (!fileId) {
      setMeta({
        thumbnailLink: null,
        fallbackThumbnailUrl: null,
        name: null,
        mimeType: null,
      });
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke<{
        thumbnailLink?: string | null;
        fallbackThumbnailUrl?: string | null;
        name?: string | null;
        mimeType?: string | null;
        error?: string;
      }>("google-drive-file-meta", {
        body: { file_id: fileId },
      });

      if (cancelled) return;
      setLoading(false);

      if (fnError) {
        devLog.debug("google-drive-file-meta invoke error", fnError.message);
        setError(null);
        setMeta({
          thumbnailLink: null,
          fallbackThumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000`,
          name: null,
          mimeType: null,
        });
        return;
      }

      if (data?.error) {
        const raw = typeof data.error === "string" ? data.error : "";
        devLog.debug("google-drive-file-meta api error", raw);
        setError(raw && !shouldReplaceDriveApiError(raw) ? raw : null);
        setMeta({
          thumbnailLink: null,
          fallbackThumbnailUrl:
            typeof data.fallbackThumbnailUrl === "string"
              ? data.fallbackThumbnailUrl
              : `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000`,
          name: null,
          mimeType: null,
        });
        return;
      }

      setMeta({
        thumbnailLink: data?.thumbnailLink ?? null,
        fallbackThumbnailUrl:
          data?.fallbackThumbnailUrl ??
          `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000`,
        name: data?.name ?? null,
        mimeType: data?.mimeType ?? null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return { ...meta, loading, error };
}
