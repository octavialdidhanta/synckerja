import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { devLog } from "@/shared/lib/logger";
import { isDriveGrantRequiredPayload } from "../utils/driveApiErrors";
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
  grantRequired: boolean;
  reload: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grantRequired, setGrantRequired] = useState(false);
  const [tick, setTick] = useState(0);
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
      setGrantRequired(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setGrantRequired(false);

    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke<{
        thumbnailLink?: string | null;
        fallbackThumbnailUrl?: string | null;
        name?: string | null;
        mimeType?: string | null;
        error?: string;
        code?: string;
      }>("google-drive-file-meta", {
        body: { file_id: fileId },
      });

      if (cancelled) return;
      setLoading(false);

      if (fnError) {
        devLog.debug("google-drive-file-meta invoke error", fnError.message);
        setGrantRequired(isDriveGrantRequiredPayload(data));
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
        setGrantRequired(isDriveGrantRequiredPayload(data));
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
  }, [fileId, tick]);

  const reload = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  return { ...meta, loading, error, grantRequired, reload };
}
