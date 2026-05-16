import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomerSurveySettingsFormValues } from "@/features/customer-survey/core/surveySettingsDefaults";
import { deriveFollowUpQuestionLabel } from "@/features/customer-survey/core/followUpLabel";
import { SurveyRatingStarRow } from "@/features/customer-survey/public/SurveyRatingStarRow";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

type Props = {
  values: CustomerSurveySettingsFormValues;
  previewOrigin: string;
  /** Stack WA + survey vertically (narrow sidebar column). */
  stackVertically?: boolean;
  className?: string;
};

/**
 * Mockup-style previews: outbound WhatsApp bubble + interactive survey card (emoji → follow-up).
 */
export function CustomerSurveySettingsVisualPreview({
  values,
  previewOrigin,
  stackVertically = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const [previewRating, setPreviewRating] = useState<number | null>(null);

  const linkPreview = useMemo(() => {
    const base = previewOrigin.replace(/\/+$/, "");
    if (!base) return t("omnichannel.settings.customerSurvey.previewUrlUnset");
    return `${base}/s/…`;
  }, [previewOrigin, t]);

  const closing = (values.closing_message ?? "").trim() || "—";

  const followPreview = deriveFollowUpQuestionLabel(values.follow_up_mode, previewRating, {
    follow_up_single: values.follow_up_single,
    follow_up_low: values.follow_up_low,
    follow_up_mid: values.follow_up_mid,
    follow_up_high: values.follow_up_high,
  });

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-medium text-foreground">{t("omnichannel.settings.customerSurvey.visualPreviewTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("omnichannel.settings.customerSurvey.visualPreviewSubtitle")}</p>
      </div>

      <div className={cn("gap-4", stackVertically ? "flex flex-col" : "grid sm:grid-cols-2")}>
        {/* WhatsApp-style chat strip */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("omnichannel.settings.customerSurvey.waPreviewLabel")}
          </p>
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-black/10",
              "bg-[#e5ddd5] shadow-inner",
            )}
            aria-label={t("omnichannel.settings.customerSurvey.waPreviewLabel")}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Cpath fill=%22%23000%22 d=%22M0 0h40v40H0zM40 40h40v40H40z%22/%3E%3C/svg%3E')]" />
            <div className="relative space-y-2 p-3 pt-4 pb-5">
              <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[#dcf8c6] px-3 py-2.5 text-[13px] leading-snug text-gray-900 shadow-sm">
                <p className="whitespace-pre-wrap">{closing}</p>
                <p className="mt-2 break-all text-[12px] font-medium text-[#039be5] underline decoration-[#039be5]/60">
                  {linkPreview}
                </p>
              </div>
              <p className="text-center text-[10px] text-gray-600/90">{t("omnichannel.settings.customerSurvey.waPreviewCaption")}</p>
            </div>
          </div>
        </div>

        {/* Public survey page card — interactive emoji row */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("omnichannel.settings.customerSurvey.surveyPreviewLabel")}
          </p>
          <div
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            role="region"
            aria-label={t("omnichannel.settings.customerSurvey.surveyPreviewLabel")}
          >
            <h3 className="text-base font-semibold leading-tight text-foreground">
              {(values.survey_page_title ?? "").trim() || "—"}
            </h3>
            <div className="mt-3 h-px w-full bg-border" aria-hidden />
            <p className="mt-4 text-sm font-medium leading-relaxed text-foreground">
              {(values.question_text ?? "").trim() || "—"}
            </p>

            <div className="mt-5">
              <SurveyRatingStarRow
                value={previewRating}
                onChange={setPreviewRating}
                minLabel={(values.scale_min_label ?? "").trim()}
                maxLabel={(values.scale_max_label ?? "").trim()}
                compact
              />
            </div>

            {followPreview ? (
              <div className="mt-5 space-y-2">
                <Label htmlFor="survey-settings-follow-preview">{followPreview}</Label>
                <Textarea
                  id="survey-settings-follow-preview"
                  readOnly
                  tabIndex={-1}
                  rows={3}
                  value=""
                  placeholder={t("customerSurvey.public.commentPlaceholder")}
                  className="resize-none bg-muted/30 text-muted-foreground"
                />
              </div>
            ) : previewRating != null && !followPreview && values.follow_up_mode !== "none" ? (
              <p className="mt-4 text-xs text-muted-foreground">{t("omnichannel.settings.customerSurvey.followUpEmptyHint")}</p>
            ) : null}

            <p className="mt-4 text-center text-[10px] text-muted-foreground">{t("omnichannel.settings.customerSurvey.surveyPreviewCaption")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
