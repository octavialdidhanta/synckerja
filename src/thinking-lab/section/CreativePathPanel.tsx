import { Check, Circle, Loader2, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  LEAD_MAGNET_PASS_IDS,
  type LeadMagnetPassCheck,
  type LeadMagnetPassId,
  type LeadMagnetReviewStep,
} from "@/thinking-lab/creative-idea/recommend";
import type { CreativeFormat, PillarFitStatus } from "@/thinking-lab/creative-idea/types";

export type CreativePathView = {
  reviews: Array<{ contentPillarId: string; pillarName: string; status: PillarFitStatus; reason: string; development?: string; offer?: string; comment?: string; trigger?: string }>;
  reviewReady?: boolean;
  selectedPillarId: string | null;
  selectedPillarName: string;
  selectedFormat: CreativeFormat | null;
  lockedPillarIds?: readonly string[];
  onReview: () => void;
  onReviewLeadMagnet?: () => void;
  onSelectPillar: (id: string) => void;
  onSelectFormat: (format: CreativeFormat) => void;
  leadMagnetStep?: LeadMagnetReviewStep | null;
};

const FORMAT_ORDER: CreativeFormat[] = ["video", "carousel", "post"];

const LEAD_MAGNET_PASS_LABELS: Record<LeadMagnetPassId, [string, string]> = {
  offer: ["thinkingLab.creative.pass.offer", "The offered material is concrete, not a generic label."],
  comment: ["thinkingLab.creative.pass.comment", "The comment is a short phrase the viewer must type."],
  trigger: ["thinkingLab.creative.pass.trigger", "The trigger names one move the viewer still cannot do."],
  withheld: ["thinkingLab.creative.pass.withheld", "The content stops before the strategies are read out."],
  fit: ["thinkingLab.creative.pass.fit", "The reason explains the gap that makes someone download."],
};

function LeadMagnetPassChecklist({ step }: { step: LeadMagnetReviewStep | null }) {
  const { t } = useAppTranslation();
  const checks: LeadMagnetPassCheck[] = step?.checks ?? LEAD_MAGNET_PASS_IDS.map((id) => ({ id, state: "pending" }));
  const running = checks.find((check) => check.state === "running");
  const runningLabel = running
    ? t(LEAD_MAGNET_PASS_LABELS[running.id][0], LEAD_MAGNET_PASS_LABELS[running.id][1])
    : "";
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{t("thinkingLab.creative.pass.title", "Pass requirements")}</p>
      {step?.drafting ? (
        <p className="flex items-start gap-2 text-sm text-foreground">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          <span>{t("thinkingLab.creative.pass.drafting", "The model is writing the offer, the comment, and the curiosity trigger.")}</span>
        </p>
      ) : running ? (
        <p className="text-sm text-foreground">
          {t("thinkingLab.bt.pass.checking", "Checking this requirement: {{gate}}", { gate: runningLabel })}
        </p>
      ) : step?.pillarName ? (
        <p className="text-sm text-foreground">
          {t("thinkingLab.creative.pass.pillar", "Checking {{name}}", { name: step.pillarName })}
        </p>
      ) : null}
      <ul className="space-y-1" aria-label={t("thinkingLab.creative.pass.title", "Pass requirements")}>
        {LEAD_MAGNET_PASS_IDS.map((id) => {
          const check = checks.find((item) => item.id === id);
          const state = check?.state ?? "pending";
          const label = t(LEAD_MAGNET_PASS_LABELS[id][0], LEAD_MAGNET_PASS_LABELS[id][1]);
          return (
            <li key={id} className="text-sm">
              <p className="flex items-start gap-2">
                {state === "running" ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                ) : state === "pass" ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
                ) : state === "fail" ? (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={state === "fail" ? "text-destructive" : state === "pending" ? "text-muted-foreground" : "text-foreground"}>
                  {label}
                  <span className="sr-only">
                    {state === "pass"
                      ? t("thinkingLab.bt.pass.passed", "Passed")
                      : state === "fail"
                        ? t("thinkingLab.bt.pass.failed", "Failed")
                        : state === "running"
                          ? t("thinkingLab.bt.pass.checkingNow", "Checking")
                          : t("thinkingLab.bt.pass.pending", "Not checked yet")}
                  </span>
                </span>
              </p>
              {state === "fail" && check?.reason ? <p className="mt-0.5 pl-5 text-sm text-muted-foreground">{check.reason}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={path.onReview} disabled={busy} aria-busy={pendingAction === "creative-review" || undefined}>
          {pendingAction === "creative-review" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("thinkingLab.creative.review", "Review pillars")}
        </Button>
        {path.onReviewLeadMagnet ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={path.onReviewLeadMagnet}
            disabled={busy}
            aria-busy={pendingAction === "creative-review-lead-magnet" || undefined}
          >
            {pendingAction === "creative-review-lead-magnet" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("thinkingLab.creative.reviewLeadMagnet", "Review pillar Lead Magnet")}
          </Button>
        ) : null}
      </div>
      {path.leadMagnetStep ? <LeadMagnetPassChecklist step={path.leadMagnetStep} /> : null}
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
                  {review.offer?.trim() ? (
                    <p className="text-sm leading-relaxed text-foreground">
                      <span className="text-muted-foreground">{t("thinkingLab.creative.leadMagnetOffer", "Offered")}: </span>
                      {review.offer}
                    </p>
                  ) : null}
                  {review.comment?.trim() ? (
                    <p className="text-sm leading-relaxed text-foreground">
                      <span className="text-muted-foreground">{t("thinkingLab.creative.leadMagnetComment", "Comment")}: </span>
                      {review.comment}
                    </p>
                  ) : null}
                  {review.trigger?.trim() ? (
                    <p className="text-sm leading-relaxed text-foreground">
                      <span className="text-muted-foreground">{t("thinkingLab.creative.leadMagnetTrigger", "Curiosity trigger")}: </span>
                      {review.trigger}
                    </p>
                  ) : null}
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
