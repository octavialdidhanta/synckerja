import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { SurveyRatingStarRow } from "@/features/customer-survey/public/SurveyRatingStarRow";
import type { SurveyFormBodyProps } from "@/features/customer-survey/public/SurveyFormBody";
import { useSurveyMobileKeyboardFooter } from "@/features/customer-survey/public/mobile/useSurveyMobileKeyboardFooter";

type Props = Omit<SurveyFormBodyProps, "density" | "className">;

export function SurveyFormMobileForm({
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
}: Props) {
  const { t } = useTranslation();
  const footerRef = useRef<HTMLDivElement>(null);
  const showComment = Boolean(followLabel);

  const { keyboardActive, keyboardBottomInsetPx, footerHeightPx, setFooterHeightPx } =
    useSurveyMobileKeyboardFooter(true);

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return;
    const measure = () => setFooterHeightPx(node.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [showComment, comment, submitting, submitError, ratingMissing, setFooterHeightPx]);

  const scrollPaddingBottom = keyboardActive
    ? footerHeightPx + keyboardBottomInsetPx + 16
    : footerHeightPx + 24;

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-background">
      <div
        className={cn(
          "min-h-0 flex-1 overscroll-contain [-webkit-overflow-scrolling:touch]",
          keyboardActive ? "overflow-hidden touch-none" : "overflow-y-auto",
        )}
        style={{ paddingBottom: scrollPaddingBottom }}
      >
        <div className="mx-auto max-w-xl px-4 pb-4 pt-8">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <div className="mt-3 h-px w-full bg-border" aria-hidden />
          <p className="mt-4 text-base font-medium leading-relaxed text-foreground">{question}</p>

          <div className="mt-8">
            <SurveyRatingStarRow
              value={rating}
              onChange={onRatingChange}
              minLabel={minLabel}
              maxLabel={maxLabel}
              compact
            />
          </div>
        </div>
      </div>

      <div
        ref={footerRef}
        className={cn(
          "shrink-0 border-t border-border/80 bg-background/95 px-4 pt-3 backdrop-blur-md",
          keyboardActive &&
            "fixed left-0 right-0 z-30 touch-none shadow-[0_-8px_32px_rgba(15,23,42,0.12)]",
        )}
        style={
          keyboardActive
            ? {
                bottom: keyboardBottomInsetPx,
                paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
              }
            : { paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }
        }
      >
        <form className="mx-auto max-w-xl space-y-3" onSubmit={onSubmit}>
          {showComment ? (
            <div className="space-y-2">
              <Label htmlFor="survey-comment" className="text-sm font-medium">
                {followLabel}
              </Label>
              <Textarea
                id="survey-comment"
                rows={3}
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                maxLength={2000}
                placeholder={t("customerSurvey.public.commentPlaceholder")}
                className="resize-none text-base leading-relaxed"
                enterKeyHint="done"
                autoComplete="off"
              />
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-destructive">{t("customerSurvey.public.submitError")}</p>
          ) : null}

          <Button type="submit" className="h-11 w-full text-base" size="lg" disabled={ratingMissing || submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("customerSurvey.public.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}