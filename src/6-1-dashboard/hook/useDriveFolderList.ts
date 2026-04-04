import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { devLog } from "@/shared/lib/logger";
import { shouldReplaceDriveApiError } from "../utils/driveInvokeFriendlyError";

export type DriveFolderItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  thumbnailLink: string | null;
  iconLink: string | null;
  webViewLink: string | null;
  fallbackThumbnailUrl: string | null;
};

export function useDriveFolderList(folderId: string | null): {
  files: DriveFolderItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const { t } = useAppTranslation();
  const [files, setFiles] = useState<DriveFolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!folderId) {
      setFiles([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke<{
        files?: DriveFolderItem[];
        error?: string;
      }>("google-drive-list-folder", {
        body: { folder_id: folderId },
      });

      if (cancelled) return;
      setLoading(false);

      if (fnError) {
        devLog.debug("google-drive-list-folder invoke error", fnError.message);
        setError(
          t(
            "googleDriveFolder.listLoadFailed",
            "Tidak bisa memuat folder dari Google Drive. Coba Putuskan lalu Hubungkan Google lagi di baris Preview, atau buka folder di Drive.",
          ),
        );
        setFiles([]);
        return;
      }

      if (data?.error) {
        const raw = typeof data.error === "string" ? data.error : "";
        devLog.debug("google-drive-list-folder api error", raw);
        const userMsg =
          raw && !shouldReplaceDriveApiError(raw)
            ? raw
            : t(
                "googleDriveFolder.listLoadFailed",
                "Tidak bisa memuat folder dari Google Drive. Coba Putuskan lalu Hubungkan Google lagi di baris Preview, atau buka folder di Drive.",
              );
        setError(userMsg);
        setFiles([]);
        return;
      }

      setFiles(Array.isArray(data?.files) ? data!.files! : []);
    })();

    return () => {
      cancelled = true;
    };
  }, [folderId, tick, t]);

  const reload = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  return {
    files,
    loading,
    error,
    reload,
  };
}
