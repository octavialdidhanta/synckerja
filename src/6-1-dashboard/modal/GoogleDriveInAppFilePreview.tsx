import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  getDirectVideoUrl,
  isFileLink,
  extractGoogleDriveFileId,
  upscaleGoogleDriveThumbnailUrl,
} from "../utils/previewUtils";
import { useDriveFileThumbnailMeta } from "../hook/useDriveFileThumbnailMeta";
import { supabase, SUPABASE_URL } from "@/shared/lib/supabaseClient";

/**
 * Google Drive file preview in-app: video or image scaled to fill the available box (object-contain).
 */
export const GoogleDriveFilePreview: React.FC<{ link: string; className?: string }> = ({
  link,
  className,
}) => {
  const { t } = useAppTranslation();
  const fileId = useMemo(() => (isFileLink(link) ? extractGoogleDriveFileId(link) : null), [link]);
  const thumbMeta = useDriveFileThumbnailMeta(fileId);

  const [thumbStripSrc, setThumbStripSrc] = useState<string | null>(null);
  const [thumbTriedFallback, setThumbTriedFallback] = useState(false);
  useEffect(() => {
    setThumbStripSrc(thumbMeta.thumbnailLink ?? thumbMeta.fallbackThumbnailUrl ?? null);
    setThumbTriedFallback(false);
  }, [fileId, thumbMeta.thumbnailLink, thumbMeta.fallbackThumbnailUrl]);

  const displayImageSrc = useMemo(
    () => (thumbStripSrc ? upscaleGoogleDriveThumbnailUrl(thumbStripSrc) : null),
    [thumbStripSrc],
  );

  /** After metadata loads: treat as video for HTML5 player (private files need Edge proxy). */
  const isVideoTarget = useMemo(() => {
    const m = thumbMeta.mimeType?.toLowerCase() ?? "";
    if (m.startsWith("video/")) return true;
    if (m.startsWith("image/")) return false;
    if (m.startsWith("application/vnd.google-apps.")) return false;
    const n = (thumbMeta.name ?? "").toLowerCase();
    if (/\.(mp4|webm|ogg|mov|m4v|mkv|avi)(\?|$)/i.test(n)) return true;
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(n)) return false;
    return false;
  }, [thumbMeta.mimeType, thumbMeta.name]);

  const [googleStreamUrl, setGoogleStreamUrl] = useState<string | null>(null);
  /** Authenticated thumbnail proxy — private Drive files block hotlinked thumbnails in the browser. */
  const [authedThumbnailUrl, setAuthedThumbnailUrl] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    if (!fileId) {
      setGoogleStreamUrl(null);
      setAuthedThumbnailUrl(null);
      setSessionChecked(false);
      return;
    }
    let cancelled = false;
    setSessionChecked(false);

    const applySession = (accessToken: string | undefined) => {
      if (cancelled) return;
      if (accessToken) {
        const media = new URL(`${SUPABASE_URL}/functions/v1/google-drive-file-media`);
        media.searchParams.set("file_id", fileId);
        media.searchParams.set("supabase_token", accessToken);
        setGoogleStreamUrl(media.toString());

        const thumb = new URL(`${SUPABASE_URL}/functions/v1/google-drive-file-thumbnail`);
        thumb.searchParams.set("file_id", fileId);
        thumb.searchParams.set("supabase_token", accessToken);
        setAuthedThumbnailUrl(thumb.toString());
      } else {
        setGoogleStreamUrl(null);
        setAuthedThumbnailUrl(null);
      }
      setSessionChecked(true);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session?.access_token);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.access_token);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [fileId]);

  const directVideoUrl = isFileLink(link) ? getDirectVideoUrl(link) : "";
  const videoSrc = useMemo(() => {
    if (!isVideoTarget) return "";
    if (!sessionChecked) return "";
    if (googleStreamUrl) return googleStreamUrl;
    return directVideoUrl;
  }, [isVideoTarget, sessionChecked, googleStreamUrl, directVideoUrl]);

  const [videoFailed, setVideoFailed] = useState(false);
  const canTryVideo = Boolean(videoSrc) && !videoFailed;

  useEffect(() => {
    setVideoFailed(false);
  }, [link, videoSrc, isVideoTarget]);

  /**
   * High-res poster for <video> only (no <img> overlay — overlay sat above native controls and hid the progress bar).
   * Prefer authenticated proxy; else upscaled public thumbnail URLs.
   */
  const videoPosterSrc = useMemo(() => {
    if (authedThumbnailUrl) return authedThumbnailUrl;
    if (displayImageSrc) return displayImageSrc;
    const raw =
      thumbMeta.thumbnailLink ??
      thumbMeta.fallbackThumbnailUrl ??
      (fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000` : null);
    return raw ? upscaleGoogleDriveThumbnailUrl(raw) : null;
  }, [
    authedThumbnailUrl,
    displayImageSrc,
    thumbMeta.thumbnailLink,
    thumbMeta.fallbackThumbnailUrl,
    fileId,
  ]);

  const onImageError = useCallback(() => {
    if (
      !thumbTriedFallback &&
      thumbMeta.thumbnailLink &&
      thumbMeta.fallbackThumbnailUrl &&
      thumbStripSrc === thumbMeta.thumbnailLink
    ) {
      setThumbTriedFallback(true);
      setThumbStripSrc(thumbMeta.fallbackThumbnailUrl);
      return;
    }
    setThumbStripSrc(null);
  }, [
    thumbTriedFallback,
    thumbMeta.thumbnailLink,
    thumbMeta.fallbackThumbnailUrl,
    thumbStripSrc,
  ]);

  let body: React.ReactNode;

  if (fileId && (thumbMeta.loading || (isVideoTarget && !sessionChecked))) {
    body = (
      <div
        className="min-h-0 flex-1 w-full animate-pulse rounded-lg bg-gray-200"
        aria-busy
        aria-label={t("googleDriveFolder.loading", "Memuat…")}
      />
    );
  } else if (canTryVideo) {
    body = (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-black">
        <video
          key={videoSrc}
          src={videoSrc}
          poster={videoPosterSrc ?? undefined}
          className="absolute inset-0 h-full w-full bg-transparent object-contain [image-rendering:auto]"
          controls
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
        />
      </div>
    );
  } else if (displayImageSrc) {
    body = (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-100 bg-neutral-950/5">
        {thumbMeta.name ? (
          <div className="shrink-0 truncate border-b border-gray-100 bg-white/95 px-2 py-1 text-xs text-gray-800">
            {thumbMeta.name}
          </div>
        ) : null}
        <div className="relative min-h-0 min-w-0 flex-1">
          <img
            src={displayImageSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            referrerPolicy="no-referrer"
            onError={onImageError}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 z-10 h-8 gap-1 shadow-md"
            onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("googleDrivePreview.openInGoogleDrive")}</span>
          </Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t("googleDrivePreview.openInGoogleDrive")}
        </Button>
        <p className="max-w-sm text-center text-xs text-gray-600">
          {t(
            "googleDrivePreview.useConnectInPreviewHeader",
            "Untuk pratinjau di aplikasi, gunakan tombol Hubungkan Google di baris judul Preview di atas.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{body}</div>
    </div>
  );
};
