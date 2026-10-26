import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { CreativeFormat, PillarFitStatus } from "@/thinking-lab/creative-idea/types";

export type CreativePathView = {
  reviews: Array<{ contentPillarId: string; pillarName: string; status: PillarFitStatus; reason: string; development?: string }>;
  reviewReady?: boolean;
  selectedPillarId: string | null;
  selectedPillarName: string;
  selectedFormat: CreativeFormat | null;
  lockedPillarIds?: readonly string[];
  onReview: () => void;
  onSelectPillar: (id: string) => void;
  onSelectFormat: (format: CreativeFormat) => void;
};

const FORMAT_ORDER: CreativeFormat[] = ["video", "carousel", "post"];

export function CreativePathPanel({
  path,
  pendingAction,
}: {
  path: CreativePathView;
  pendingAction?: string | null;
}) {
  const { t } = useAppTranslation();
  const busy = Boolean(pendingAction);
  const hidden = new Set(path.lockedPillarIds ?? []);
  const recommended = path.reviews.filter(
    (review) => review.status === "RECOMMENDED" && review.development?.trim() && review.reason.trim() && !hidden.has(review.contentPillarId),
  );
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("thinkingLab.creative.title", "Develop this idea")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(
            "thinkingLab.creative.hint",
            "Review pillars that can carry this idea. Each recommendation shows what the idea becomes in that pillar, and why that fit holds. Lock one pillar. The locked pillar leaves this Idea and opens as its own section in the map.",
          )}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={path.onReview} disabled={busy} aria-busy={pendingAction === "creative-review" || undefined}>
        {pendingAction === "creative-review" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {t("thinkingLab.creative.review", "Review pillars")}
      </Button>
      {recommended.length > 0 ? (
        <ul className="space-y-2">
          {recommended.map((review) => {
            const locked = path.selectedPillarId === review.contentPillarId;
            return (
              <li key={review.contentPillarId}>
                <div
                  className={cn(
                    "w-full space-y-2 rounded-lg border px-3 py-3 text-left",
                    locked ? "border-primary bg-primary/5" : "border-border bg-background",
                  )}
                >
                  <span className="flex w-full flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{review.pillarName}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("thinkingLab.creative.status.RECOMMENDED", "Recommended")}
                    </span>
                    {locked ? (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {t("thinkingLab.creative.locked", "Locked")}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        disabled={busy}
                        aria-label={`${t("thinkingLab.action.lock", "Lock")} ${review.pillarName}`}
                        onClick={() => path.onSelectPillar(review.contentPillarId)}
                      >
                        {t("thinkingLab.action.lock", "Lock")}
                      </Button>
                    )}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.creative.pillarDevelopment", "In this pillar the idea becomes")}: </span>
                    {review.development}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.creative.pillarReason", "Why this pillar is recommended")}: </span>
                    {review.reason}
                  </p>
                  {locked ? (
                    <div className="flex flex-wrap gap-1" role="group" aria-label={t("thinkingLab.creative.formatLabel", "Content format")}>
                      {FORMAT_ORDER.map((format) => (
                        <Button
                          key={format}
                          type="button"
                          size="sm"
                          variant={path.selectedFormat === format ? "default" : "outline"}
                          aria-pressed={path.selectedFormat === format}
                          disabled={busy}
                          onClick={() => path.onSelectFormat(format)}
                        >
                          {t(`thinkingLab.creative.format.${format}`, format === "post" ? "Static Post" : format === "carousel" ? "Carousel" : "Video")}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : path.reviewReady && hidden.size === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("thinkingLab.creative.reviewEmpty", "No pillar passed the recommendation check.")}
        </p>
      ) : null}
    </div>
  );
}
