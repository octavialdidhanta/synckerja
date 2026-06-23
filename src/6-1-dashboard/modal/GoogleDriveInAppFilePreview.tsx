import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/shared/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  getDirectVideoUrl,
  getEmbedUrl,
  getGoogleDriveUcDownloadUrl,
  isFileLink,
  extractGoogleDriveFileId,
  upscaleGoogleDriveThumbnailUrl,
} from "../utils/previewUtils";
import { useDriveFileThumbnailMeta } from "../hook/useDriveFileThumbnailMeta";
import { useGoogleDriveFileGrant } from "../hook/useGoogleDriveFileGrant";
import { supabase, SUPABASE_URL } from "@/shared/lib/supabaseClient";

/**
 * Google Drive file preview in-app: video or image scaled to fill the available box (object-contain).
 */
export const GoogleDriveFilePreview: React.FC<{
  link: string;
  className?: string;
  /** TikTok / Reel previews: always try HTML5 video + Drive embed fallback. */
  forceVideo?: boolean;
}> = ({
  link,
  className,
  forceVideo = false,
}) => {
  const { t } = useAppTranslation();
  const fileId = useMemo(() => (isFileLink(link) ? extractGoogleDriveFileId(link) : null), [link]);
  const { granting, grantDriveResource } = useGoogleDriveFileGrant();
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

  /** Prefer filename extension over mimeType (Drive metadata can be wrong for generated videos). */
  const isVideoTarget = useMemo(() => {
    const n = (thumbMeta.name ?? "").toLowerCase();
    const hasVideoExt = /\.(mp4|webm|ogg|mov|m4v|mkv|avi)(\?|$)/i.test(n);
    const hasImageExt = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(n);
    if (forceVideo || hasVideoExt) return true;
    if (hasImageExt) return false;
    const m = thumbMeta.mimeType?.toLowerCase() ?? "";
    if (m.startsWith("image/")) return false;
    if (m.startsWith("video/")) return true;
    if (m.startsWith("application/vnd.google-apps.")) return false;
    return false;
  }, [thumbMeta.mimeType, thumbMeta.name, forceVideo]);

  const embedUrl = useMemo(() => getEmbedUrl(link), [link]);

  const [streamTick, setStreamTick] = useState(0);
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
  }, [fileId, streamTick]);

  const directVideoUrl = isFileLink(link) ? getDirectVideoUrl(link) : "";
  const ucVideoUrl = isFileLink(link) ? getGoogleDriveUcDownloadUrl(link) : "";

  const videoSources = useMemo(() => {
    if (!isVideoTarget || !sessionChecked) return [];
    const list: string[] = [];
    const seen = new Set<string>();
    const push = (url: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      list.push(url);
    };
    push(directVideoUrl);
    push(ucVideoUrl);
    if (googleStreamUrl) push(googleStreamUrl);
    return list;
  }, [isVideoTarget, sessionChecked, directVideoUrl, ucVideoUrl, googleStreamUrl]);

  const [videoIndex, setVideoIndex] = useState(0);
  const [useDriveEmbed, setUseDriveEmbed] = useState(false);

  useEffect(() => {
    setVideoIndex(0);
    setUseDriveEmbed(false);
  }, [link, isVideoTarget]);

  useEffect(() => {
    if (!sessionChecked) return;
    setVideoIndex(0);
  }, [sessionChecked, videoSources.length]);

  const currentVideoUrl = videoSources[videoIndex] ?? null;
  const videoExhausted =
    sessionChecked && isVideoTarget && videoSources.length > 0 && videoIndex >= videoSources.length;
  const noVideoSources = sessionChecked && isVideoTarget && videoSources.length === 0;

  const resetVideoPreview = useCallback(() => {
    setUseDriveEmbed(false);
    setVideoIndex(0);
  }, []);

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

  const driveEmbedPlayer = embedUrl ? (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-black">
      <iframe
        title={t("googleDrivePreview.driveEmbedTitle", "Pratinjau Google Drive")}
        src={embedUrl}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {currentVideoUrl || videoExhausted ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute bottom-2 left-1/2 z-10 h-8 -translate-x-1/2 gap-1 px-2 text-xs shadow-md"
          onClick={resetVideoPreview}
        >
          {t("digitalMarketing.scheduledPosts.videoPreviewNativePlayer", "Video player")}
        </Button>
      ) : null}
    </div>
  ) : null;

  const grantOrOpenFallback = (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
      {fileId && thumbMeta.grantRequired && googleStreamUrl ? (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8"
          disabled={granting}
          onClick={() =>
            void grantDriveResource(fileId, {
              isFolder: false,
              onGranted: () => {
                thumbMeta.reload();
                resetVideoPreview();
                setStreamTick((n) => n + 1);
              },
            })
          }
        >
          {granting
            ? t("googleDrivePreview.grantInProgress", "Membuka Google Picker…")
            : t("googleDrivePreview.grantFileAccess", "Izinkan akses file")}
        </Button>
      ) : null}
      <p className="max-w-sm text-center text-xs text-gray-600">
        {t(
          "digitalMarketing.scheduledPosts.videoPreviewPlayFailed",
          "Pratinjau tidak tersedia. Buka di Google Drive atau set sharing ke Siapa saja dengan tautan dapat melihat.",
        )}
      </p>
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
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={resetVideoPreview}>
          {t("digitalMarketing.scheduledPosts.videoPreviewRetry", "Coba lagi")}
        </Button>
        {embedUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setUseDriveEmbed(true)}>
            {t("digitalMarketing.scheduledPosts.videoPreviewDriveEmbed", "Pemutar Drive")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  let body: React.ReactNode;

  if (fileId && isVideoTarget) {
    if (!sessionChecked) {
      body = (
        <div
          className="min-h-0 flex-1 w-full animate-pulse rounded-lg bg-gray-200"
          aria-busy
          aria-label={t("googleDriveFolder.loading", "Memuat…")}
        />
      );
    } else if ((useDriveEmbed || videoExhausted || noVideoSources) && embedUrl) {
      body = driveEmbedPlayer;
    } else if (currentVideoUrl) {
      body = (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-black">
          <video
            key={currentVideoUrl}
            src={currentVideoUrl}
            poster={videoPosterSrc ?? undefined}
            className="absolute inset-0 h-full w-full bg-transparent object-contain [image-rendering:auto]"
            controls
            playsInline
            preload="metadata"
            onError={() => setVideoIndex((idx) => idx + 1)}
          />
          {embedUrl ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 z-10 h-8 gap-1 px-2 text-xs shadow-md"
              onClick={() => setUseDriveEmbed(true)}
            >
              {t("digitalMarketing.scheduledPosts.videoPreviewDriveEmbed", "Pemutar Drive")}
            </Button>
          ) : null}
        </div>
      );
    } else if (videoExhausted || noVideoSources) {
      body = grantOrOpenFallback;
    } else {
      body = (
        <div
          className="min-h-0 flex-1 w-full animate-pulse rounded-lg bg-gray-200"
          aria-busy
          aria-label={t("googleDriveFolder.loading", "Memuat…")}
        />
      );
    }
  } else if (fileId && !forceVideo && thumbMeta.loading) {
    body = (
      <div
        className="min-h-0 flex-1 w-full animate-pulse rounded-lg bg-gray-200"
        aria-busy
        aria-label={t("googleDriveFolder.loading", "Memuat…")}
      />
    );
  } else if (forceVideo && embedUrl) {
    body = driveEmbedPlayer;
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
    body = grantOrOpenFallback;
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{body}</div>
    </div>
  );
};
