import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import type { CustomerSurveySettingsFormValues } from "@/features/customer-survey/core/surveySettingsDefaults";
import { FOLLOW_UP_MODES } from "@/features/customer-survey/core/surveySettingsDefaults";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { CustomerSurveySettingsVisualPreview } from "@/features/customer-survey/settings/CustomerSurveySettingsVisualPreview";

type Props = {
  values: CustomerSurveySettingsFormValues;
  onChange: (next: CustomerSurveySettingsFormValues) => void;
  onSave: () => void;
  saving: boolean;
  previewOrigin: string;
  /** Desktop: preview column on the right (sticky). Mobile stays stacked. */
  previewAside?: boolean;
};

export function CustomerSurveySettingsForm({
  values,
  onChange,
  onSave,
  saving,
  previewOrigin,
  previewAside = false,
}: Props) {
  const { t } = useTranslation();

  const patch = (partial: Partial<CustomerSurveySettingsFormValues>) => {
    onChange({ ...values, ...partial });
  };

  return (
    <div
      className={cn(
        "grid gap-6 pb-4",
        previewAside && "lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:items-start",
      )}
    >
      <div className={cn("space-y-6", previewAside && "lg:col-start-1 lg:row-start-1")}>
        <div className="mt-4 flex flex-row flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">{t("omnichannel.settings.customerSurvey.toggleTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("omnichannel.settings.customerSurvey.toggleHint")}</p>
        </div>
        <Switch
          checked={values.is_enabled}
          onCheckedChange={(v) => patch({ is_enabled: Boolean(v) })}
          aria-label={t("omnichannel.settings.customerSurvey.toggleTitle")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="survey_question">{t("omnichannel.settings.customerSurvey.questionLabel")}</Label>
          <Textarea
            id="survey_question"
            maxLength={240}
            rows={3}
            value={values.question_text}
            onChange={(e) => patch({ question_text: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scale_min">{t("omnichannel.settings.customerSurvey.scaleMinLabel")}</Label>
          <Input
            id="scale_min"
            maxLength={30}
            value={values.scale_min_label}
            onChange={(e) => patch({ scale_min_label: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scale_max">{t("omnichannel.settings.customerSurvey.scaleMaxLabel")}</Label>
          <Input
            id="scale_max"
            maxLength={30}
            value={values.scale_max_label}
            onChange={(e) => patch({ scale_max_label: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("omnichannel.settings.customerSurvey.promoterMinTitle")}</Label>
          <Select
            value={String(values.promoter_min_rating)}
            onValueChange={(v) => patch({ promoter_min_rating: Number(v) })}
          >
            <SelectTrigger aria-label={t("omnichannel.settings.customerSurvey.promoterMinTitle")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {t("omnichannel.settings.customerSurvey.promoterMinOption", { score: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("omnichannel.settings.customerSurvey.promoterMinHint")}</p>
        </div>

        <div className="space-y-3 md:col-span-2">
          <Label>{t("omnichannel.settings.customerSurvey.followUpModeTitle")}</Label>
          <RadioGroup
            value={values.follow_up_mode}
            onValueChange={(v) => {
              if (FOLLOW_UP_MODES.includes(v as (typeof FOLLOW_UP_MODES)[number])) {
                patch({ follow_up_mode: v as CustomerSurveySettingsFormValues["follow_up_mode"] });
              }
            }}
            className="flex flex-col gap-3"
          >
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1 hover:bg-muted/60">
              <RadioGroupItem value="none" id="fu_none" className="mt-1" />
              <div>
                <span className="text-sm font-medium">{t("omnichannel.settings.customerSurvey.followUpNone")}</span>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1 hover:bg-muted/60">
              <RadioGroupItem value="single" id="fu_single" className="mt-1" />
              <div className="flex-1 space-y-2">
                <span className="text-sm font-medium">{t("omnichannel.settings.customerSurvey.followUpSingle")}</span>
                <Textarea
                  disabled={values.follow_up_mode !== "single"}
                  rows={2}
                  maxLength={500}
                  value={values.follow_up_single ?? ""}
                  onChange={(e) => patch({ follow_up_single: e.target.value })}
                  placeholder={t("omnichannel.settings.customerSurvey.followUpPlaceholder")}
                />
              </div>
            </label>
            <div className="space-y-3 rounded-md border border-transparent px-1 py-1">
              <label className="flex cursor-pointer items-start gap-2 hover:bg-muted/60">
                <RadioGroupItem value="by_score" id="fu_by_score" className="mt-0.5 shrink-0" />
                <span className="text-sm font-medium">
                  {t("omnichannel.settings.customerSurvey.followUpByScore")}
                </span>
              </label>
              <div className="grid grid-cols-1 gap-3 ps-7 sm:grid-cols-3 sm:items-start">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="fu_low" className="text-xs font-normal text-muted-foreground">
                    {t("omnichannel.settings.customerSurvey.followUpLowBand")}
                  </Label>
                  <Textarea
                    id="fu_low"
                    disabled={values.follow_up_mode !== "by_score"}
                    rows={2}
                    maxLength={500}
                    className="min-h-[4.5rem] resize-y"
                    value={values.follow_up_low ?? ""}
                    onChange={(e) => patch({ follow_up_low: e.target.value })}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="fu_mid" className="text-xs font-normal text-muted-foreground">
                    {t("omnichannel.settings.customerSurvey.followUpMidBand")}
                  </Label>
                  <Textarea
                    id="fu_mid"
                    disabled={values.follow_up_mode !== "by_score"}
                    rows={2}
                    maxLength={500}
                    className="min-h-[4.5rem] resize-y"
                    value={values.follow_up_mid ?? ""}
                    onChange={(e) => patch({ follow_up_mid: e.target.value })}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="fu_high" className="text-xs font-normal text-muted-foreground">
                    {t("omnichannel.settings.customerSurvey.followUpHighBand")}
                  </Label>
                  <Textarea
                    id="fu_high"
                    disabled={values.follow_up_mode !== "by_score"}
                    rows={2}
                    maxLength={500}
                    className="min-h-[4.5rem] resize-y"
                    value={values.follow_up_high ?? ""}
                    onChange={(e) => patch({ follow_up_high: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="closing">{t("omnichannel.settings.customerSurvey.closingLabel")}</Label>
          <Textarea
            id="closing"
            rows={3}
            maxLength={1000}
            value={values.closing_message}
            onChange={(e) => patch({ closing_message: e.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="page_title">{t("omnichannel.settings.customerSurvey.pageTitleLabel")}</Label>
          <Input
            id="page_title"
            maxLength={120}
            value={values.survey_page_title}
            onChange={(e) => patch({ survey_page_title: e.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="thank_you">{t("omnichannel.settings.customerSurvey.thankYouLabel")}</Label>
          <Textarea
            id="thank_you"
            rows={2}
            maxLength={500}
            value={values.thank_you_message}
            onChange={(e) => patch({ thank_you_message: e.target.value })}
          />
        </div>
      </div>
      </div>

      <CustomerSurveySettingsVisualPreview
        values={values}
        previewOrigin={previewOrigin}
        stackVertically={previewAside}
        className={cn(
          previewAside &&
            "lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4 lg:self-start",
        )}
      />

      <div className={cn("flex flex-wrap gap-2", previewAside && "lg:col-start-1 lg:row-start-2")}>
        <Button type="button" onClick={() => onSave()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("omnichannel.settings.customerSurvey.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => toast.info(t("omnichannel.settings.customerSurvey.previewToast"))}
        >
          {t("omnichannel.settings.customerSurvey.previewHintButton")}
        </Button>
      </div>
    </div>
  );
}

