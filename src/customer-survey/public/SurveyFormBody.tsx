import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { SurveyRatingStarRow } from "@/features/customer-survey/public/SurveyRatingStarRow";

export type SurveyFormBodyProps = {
  title: string;
  question: string;
  rating: number | null;
  onRatingChange: (n: number) => void;
  minLabel: string;
  maxLabel: string;
  followLabel: string | null;
  comment: string;
  onCommentChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitError: boolean;
  ratingMissing: boolean;
  density: "comfortable" | "compact";
  className?: string;
};

export function SurveyFormBody({
  title,
  question,
  rating,
  onRatingChange,
  minLabel,
  maxLabel,
  followLabel,
  comment,
  onCommentChange,
  onSubmit,
  submitting,
  submitError,
  ratingMissing,
  density,
  className,
}: SurveyFormBodyProps) {
  const compact = density === "compact";
  const { t } = useTranslation();
  return (
    <div className={cn("mx-auto max-w-xl px-4", compact ? "py-8" : "py-14", className)}>
      <h1 className={cn("font-semibold tracking-tight", compact ? "text-lg" : "text-xl")}>{title}</h1>
      <div className="mt-3 h-px w-full bg-border" aria-hidden />

      <p className="mt-4 text-base font-medium leading-relaxed text-foreground">{question}</p>

      <form className="mt-8 space-y-8" onSubmit={onSubmit}>
        <SurveyRatingStarRow
          value={rating}
          onChange={onRatingChange}
          minLabel={minLabel}
          maxLabel={maxLabel}
          compact={compact}
        />

        {followLabel ? (
          <div className="space-y-2">
            <Label htmlFor="survey-comment">{followLabel}</Label>
            <Textarea
              id="survey-comment"
              rows={compact ? 3 : 4}
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              maxLength={2000}
              placeholder={t("customerSurvey.public.commentPlaceholder")}
              className="resize-y"
            />
          </div>
        ) : null}

        {submitError ? (
          <p className="text-sm text-destructive">{t("customerSurvey.public.submitError")}</p>
        ) : null}

        <Button type="submit" className="w-full sm:max-w-none" size="lg" disabled={ratingMissing || submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("customerSurvey.public.submit")}
        </Button>
      </form>
    </div>
  );
}

export function SurveyStaticPanel({
  title,
  body,
  density,
  className,
}: {
  title: string;
  body: string;
  density: "comfortable" | "compact";
  className?: string;
}) {
  const compact = density === "compact";
  return (
    <div
      className={cn(
        "mx-auto max-w-lg px-4 text-center text-muted-foreground",
        compact ? "py-12 text-sm" : "py-16 text-base",
        className,
      )}
    >
      <h1 className={cn("font-semibold text-foreground", compact ? "text-base" : "text-lg")}>{title}</h1>
      <p className="mt-3 leading-relaxed">{body}</p>
    </div>
  );
}

export function SurveyThanksPanel({
  message,
  density,
  className,
  layout = "inline",
}: {
  message: string;
  density: "comfortable" | "compact";
  className?: string;
  layout?: "inline" | "fullscreen";
}) {
  const compact = density === "compact";
  const { t } = useTranslation();
  const fullscreen = layout === "fullscreen";

  const card = (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border/70 bg-card px-6 text-center shadow-md",
        compact ? "py-9" : "py-11",
        !fullscreen && "mx-auto",
      )}
    >
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
        aria-hidden
      >
        <CheckCircle2 className="h-8 w-8 text-primary" strokeWidth={2} />
      </div>
      <p
        className={cn(
          "mt-6 whitespace-pre-wrap font-semibold leading-relaxed text-foreground",
          compact ? "text-lg" : "text-xl",
        )}
      >
        {message}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {t("customerSurvey.public.canClosePage")}
      </p>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-10 flex flex-col items-center justify-center bg-background px-6",
          "pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]",
          className,
        )}
      >
        {card}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[min(100dvh,720px)] max-w-lg flex-col items-center justify-center px-4 text-center",
        compact ? "py-12" : "py-16",
        className,
      )}
    >
      {card}
    </div>
  );
}
