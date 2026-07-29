import { useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/mobile-app/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { SharePublishVideo } from "../lib/sharePublishVideo";

type Props = {
  video: SharePublishVideo | null;
  isPortrait: boolean | null;
  uploadProgress: number;
  uploading: boolean;
  readyToPublish?: boolean;
  existingDriveLink?: string | null;
  canSkipUpload?: boolean;
  onReplaceVideo?: () => void;
};

export function SharePublishMediaStep({
  video,
  isPortrait,
  uploadProgress,
  uploading,
  readyToPublish = false,
  existingDriveLink,
  canSkipUpload = false,
  onReplaceVideo,
}: Props) {
  const { t } = useAppTranslation();

  const previewUrl = useMemo(() => {
    if (!video) return null;
    return Capacitor.convertFileSrc(video.path);
  }, [video?.path]);

  const sizeLabel = useMemo(() => {
    if (!video?.size) return "";
    const mb = video.size / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }, [video?.size]);

  const showExistingLinkBanner = canSkipUpload && Boolean(existingDriveLink?.trim());

  return (
    <div className="rounded-xl border border-border/70 bg-white p-2.5">
      <p className="text-xs font-medium text-muted-foreground">Video</p>

      {showExistingLinkBanner ? (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-sm font-medium text-emerald-900">
            {t(
              "share.publish.media.usingExisting",
              "Using the video already saved on this plan",
            )}
          </p>
          <a
            href={existingDriveLink!.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block truncate text-xs text-emerald-800 underline"
          >
            {existingDriveLink!.trim()}
          </a>
          {onReplaceVideo ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-8"
              onClick={onReplaceVideo}
            >
              {t("share.publish.media.replaceVideo", "Replace with shared video")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {previewUrl && !showExistingLinkBanner ? (
        <video
          key={`${previewUrl}-${uploading ? "uploading" : "idle"}`}
          src={previewUrl}
          controls
          playsInline
          preload="metadata"
          className="mt-2 max-h-56 w-full rounded-lg bg-black object-contain"
        />
      ) : !showExistingLinkBanner ? (
        <div className="mt-2 flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          No preview
        </div>
      ) : null}

      {previewUrl && showExistingLinkBanner ? (
        <video
          key={`${previewUrl}-existing`}
          src={previewUrl}
          controls
          playsInline
          preload="metadata"
          className="mt-2 max-h-40 w-full rounded-lg bg-black object-contain opacity-80"
        />
      ) : null}

      {video && !showExistingLinkBanner ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="truncate">{video.name}</span>
          {sizeLabel ? <span>· {sizeLabel}</span> : null}
          {isPortrait === true ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Portrait → Reel</span>
          ) : isPortrait === false ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Landscape</span>
          ) : null}
        </div>
      ) : null}

      {uploading ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {t("share.publish.media.uploadingToDrive", "Uploading to Google Drive…")}
            </span>
            <span>{Math.round(uploadProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.max(2, Math.round(uploadProgress * 100))}%` }}
            />
          </div>
        </div>
      ) : readyToPublish ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-sm font-medium text-emerald-900">
            {t("share.publish.media.readyToPublish", "Video saved — ready to publish")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
