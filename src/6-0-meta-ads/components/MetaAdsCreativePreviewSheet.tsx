import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import {
  useMetaAdCreativePlayback,
  type MetaAdCreativePreview,
} from "@/meta-ads/hooks/useMetaAdsAdCreatives";
import { useMetaAdsAdsetAudience } from "@/meta-ads/hooks/useMetaAdsAdsetAudience";
import {
  metaAdReviewAudience,
  type MetaAdReviewAudienceBlock,
} from "@/meta-ads/metrics/metaAdsetAudience";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  adId?: string | null;
  adsetId?: string | null;
  organizationId?: string | null;
  adAccountId?: string | null;
  creative: MetaAdCreativePreview | null;
  loading?: boolean;
  errorMessage?: string | null;
};

export function MetaAdsCreativePreviewSheet({
  open,
  onOpenChange,
  name,
  adId = null,
  adsetId = null,
  organizationId = null,
  adAccountId = null,
  creative,
  loading = false,
  errorMessage = null,
}: Props) {
  const { t } = useAppTranslation();
  const playback = useMetaAdCreativePlayback({
    enabled: open,
    organizationId,
    adAccountId,
    adId,
  });
  const videoUrl = playback.data?.video_url ?? null;
  const poster = creative?.thumbnail_url || creative?.image_url || playback.data?.thumbnail_url || null;
  const images = creative?.images?.length
    ? creative.images
    : creative?.image_url
      ? [creative.image_url]
      : poster
        ? [poster]
        : [];
  const [imageIndex, setImageIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setVideoFailed(false);
  }, [adId, open, videoUrl]);

  const isVideo = (creative?.media_type ?? playback.data?.media_type) === "video";
  const showVideo = open && Boolean(videoUrl) && !videoFailed;
  const currentImage = images[Math.min(imageIndex, Math.max(images.length - 1, 0))] ?? null;
  const showCarousel = !isVideo && images.length > 1;
  const waiting = open && isVideo && !showVideo && (loading || playback.isLoading || playback.isFetching);
  const playbackError = playback.isError ? (playback.error as Error).message : errorMessage;
  const copySource = playback.data ?? creative;
  const headline = copySource?.headline?.trim() || null;
  const description = copySource?.description?.trim() || null;
  const audience = useMetaAdsAdsetAudience({
    enabled: open,
    organizationId,
    adAccountId,
    adsetId,
  });
  const audienceBlocks = metaAdReviewAudience({
    targeting: audience.data?.targeting,
    sentenceLines: audience.data?.sentence_lines,
  });
  const audienceLoading = open && (audience.isLoading || audience.isFetching) && !audience.data;
  const audienceLabels: Record<MetaAdReviewAudienceBlock["key"], string> = {
    custom: t("digitalMarketing.metaAds.audienceCustom", "Custom audiences"),
    match: t("digitalMarketing.metaAds.audiencePeopleWhoMatch", "People who match"),
    location: t("digitalMarketing.metaAds.audienceLocations", "Locations"),
    age: t("digitalMarketing.metaAds.audienceAge", "Age"),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent hideCloseButton side="right" className="scrollbar-hide flex w-full flex-col gap-0 overflow-x-hidden overflow-y-auto p-0 [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-md [&::-webkit-scrollbar]:hidden">
        <SheetHeader className="flex-row items-center gap-3 space-y-0 px-5 py-4 text-left">
          <SheetTitle className="min-w-0 flex-1 break-words text-base leading-snug">{name}</SheetTitle>
          <SheetClose className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <ArrowRight className="h-5 w-5" />
            <span className="sr-only">{t("layout.sheetClose", "Close")}</span>
          </SheetClose>
        </SheetHeader>
        <div className="w-full">
          {showVideo ? (
            <video
              key={videoUrl ?? ""}
              src={videoUrl ?? undefined}
              poster={poster ?? undefined}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="block w-full"
              onLoadedMetadata={(event) => {
                const el = event.currentTarget;
                el.muted = false;
                el.volume = 1;
              }}
              onError={() => setVideoFailed(true)}
            />
          ) : currentImage ? (
            <img src={currentImage} alt="" className="block w-full" />
          ) : waiting ? (
            <div className="h-64 w-full animate-pulse bg-neutral-800" />
          ) : (
            <p className="px-5 py-10 text-center text-sm text-white/80">
              {playbackError ||
                t(
                  "digitalMarketing.metaAds.creativePreviewUnavailable",
                  "This ad creative cannot be previewed.",
                )}
            </p>
          )}
        </div>
        {headline || description ? (
          <div className="space-y-4 px-5 py-4">
            {headline ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("digitalMarketing.metaAds.creativeHeadline", "Headline")}
                </p>
                <p className="text-sm font-semibold leading-snug">{headline}</p>
              </div>
            ) : null}
            {description ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("digitalMarketing.metaAds.creativeDescription", "Description")}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{description}</p>
              </div>
            ) : null}
          </div>
        ) : null}
        {adsetId ? (
          <div className="space-y-3 border-t border-border px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("digitalMarketing.metaAds.audienceTitle", "Audience")}
            </p>
            {audienceLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("digitalMarketing.metaAds.audienceLoading", "Loading audience…")}
              </p>
            ) : audience.isError ? (
              <p className="text-sm text-red-600">{(audience.error as Error).message}</p>
            ) : audienceBlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("digitalMarketing.metaAds.audienceEmpty", "No audience settings on this ad set.")}
              </p>
            ) : (
              <dl className="space-y-3">
                {audienceBlocks.map((block) => (
                  <div key={block.key}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {audienceLabels[block.key]}
                    </dt>
                    <dd className="mt-1 space-y-1 text-sm text-foreground">
                      {block.values.map((value) => (
                        <p key={value} className="break-words">
                          {value}
                        </p>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : null}
        {showCarousel ? (
          <div className="flex items-center justify-between px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={imageIndex <= 0}
              onClick={() => setImageIndex((index) => Math.max(0, index - 1))}
              aria-label={t("digitalMarketing.metaAds.creativePrevious", "Previous")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {imageIndex + 1} / {images.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={imageIndex >= images.length - 1}
              onClick={() => setImageIndex((index) => Math.min(images.length - 1, index + 1))}
              aria-label={t("digitalMarketing.metaAds.creativeNext", "Next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        {waiting ? (
          <p className="px-5 py-3 text-xs text-muted-foreground">
            {t("digitalMarketing.metaAds.creativeVideoLoading", "Loading video…")}
          </p>
        ) : null}
        {isVideo && !showVideo && !waiting && currentImage ? (
          <p className="px-5 py-3 text-xs text-muted-foreground">
            {t(
              "digitalMarketing.metaAds.creativeVideoUnavailable",
              "The video file is not available. Showing the thumbnail instead.",
            )}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
