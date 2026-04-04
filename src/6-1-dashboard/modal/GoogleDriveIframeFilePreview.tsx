import React, { useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { getEmbedUrl } from "../utils/previewUtils";

/**
 * Google Drive file preview via official embed (works without stored Google tokens; requires file sharing that allows preview).
 */
export const GoogleDriveIframeFilePreview: React.FC<{ link: string; className?: string }> = ({
  link,
  className,
}) => {
  const { t } = useAppTranslation();
  const embedUrl = useMemo(() => getEmbedUrl(link), [link]);

  if (!embedUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-black p-4 text-center text-sm text-gray-400">
        {t("googleDrivePreview.iframeUnavailable", "Pratinjau embed tidak tersedia untuk tautan ini.")}
      </div>
    );
  }

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-black", className)}>
      <iframe
        title={t("googleDrivePreview.driveEmbedTitle", "Pratinjau Google Drive")}
        src={embedUrl}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};
