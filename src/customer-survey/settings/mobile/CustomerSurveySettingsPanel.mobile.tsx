import type { CustomerSurveySettingsFormValues } from "@/features/customer-survey/core/surveySettingsDefaults";
import { CustomerSurveySettingsForm } from "@/features/customer-survey/settings/CustomerSurveySettingsForm";

type Props = {
  draft: CustomerSurveySettingsFormValues;
  setDraft: (v: CustomerSurveySettingsFormValues) => void;
  onSave: () => void;
  saving: boolean;
  previewOrigin: string;
};

export function CustomerSurveySettingsPanelMobile({ draft, setDraft, onSave, saving, previewOrigin }: Props) {
  return (
    <CustomerSurveySettingsForm
      values={draft}
      onChange={setDraft}
      onSave={onSave}
      saving={saving}
      previewOrigin={previewOrigin}
    />
  );
}
