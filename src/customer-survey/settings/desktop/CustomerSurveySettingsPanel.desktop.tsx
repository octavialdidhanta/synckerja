import type { CustomerSurveySettingsFormValues } from "@/features/customer-survey/core/surveySettingsDefaults";
import { CustomerSurveySettingsForm } from "@/features/customer-survey/settings/CustomerSurveySettingsForm";

type Props = {
  draft: CustomerSurveySettingsFormValues;
  setDraft: (v: CustomerSurveySettingsFormValues) => void;
  onSave: () => void;
  saving: boolean;
  previewOrigin: string;
};

export function CustomerSurveySettingsPanelDesktop({ draft, setDraft, onSave, saving, previewOrigin }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <CustomerSurveySettingsForm
        values={draft}
        onChange={setDraft}
        onSave={onSave}
        saving={saving}
        previewOrigin={previewOrigin}
        previewAside
      />
    </div>
  );
}
