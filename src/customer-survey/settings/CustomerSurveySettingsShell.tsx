import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  omnichannelSettingsPath,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { useCustomerSurveySettings } from "@/features/customer-survey/hooks/useCustomerSurveySettings";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import type { CustomerSurveySettingsFormValues } from "@/features/customer-survey/core/surveySettingsDefaults";
import { CustomerSurveySettingsPanelDesktop } from "@/features/customer-survey/settings/desktop/CustomerSurveySettingsPanel.desktop";
import { CustomerSurveySettingsPanelMobile } from "@/features/customer-survey/settings/mobile/CustomerSurveySettingsPanel.mobile";
import { useIsMobile } from "@/shared/hooks/use-mobile";

export function CustomerSurveySettingsShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (gatePending || !organizationId) return;
    if (!canManage) {
      toast.message(t("omnichannel.settings.customerSurvey.adminOnlyToast"));
      navigate(omnichannelSettingsPath("user-management"), { replace: true });
    }
  }, [canManage, gatePending, navigate, organizationId, t]);

  const { data, isPending, saveMutation, defaults } = useCustomerSurveySettings(organizationId);
  const [draft, setDraft] = useState<CustomerSurveySettingsFormValues | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const previewOrigin =
    import.meta.env.VITE_PUBLIC_SURVEY_ORIGIN?.trim() || `${window.location.origin}`.replace(/\/+$/, "");

  const handleSave = async () => {
    if (!draft) return;
    try {
      await saveMutation.mutateAsync(draft);
      toast.success(t("omnichannel.settings.customerSurvey.saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("omnichannel.settings.customerSurvey.saveFailed"));
    }
  };

  if (gatePending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={OMNICHANNEL_SETTINGS_CARD_HEADER_BASE}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
        <div className="scrollbar-hide flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!canManage) {
    return null;
  }

  if (isPending || !draft || !defaults) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={OMNICHANNEL_SETTINGS_CARD_HEADER_BASE}>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <div className="scrollbar-hide flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`${OMNICHANNEL_SETTINGS_CARD_HEADER_BASE} shrink-0`}>
        <h2 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>{t("omnichannel.settings.customerSurvey.pageTitle")}</h2>
        <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>{t("omnichannel.settings.customerSurvey.intro")}</p>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!import.meta.env.VITE_PUBLIC_SURVEY_ORIGIN?.trim() ? (
          <Alert className="mb-4 border-amber-500/40 bg-amber-500/10">
            <AlertTitle>{t("omnichannel.settings.customerSurvey.envMissingTitle")}</AlertTitle>
            <AlertDescription>{t("omnichannel.settings.customerSurvey.envMissingBody")}</AlertDescription>
          </Alert>
        ) : null}

        {isMobile ? (
          <CustomerSurveySettingsPanelMobile
            draft={draft}
            setDraft={setDraft}
            onSave={handleSave}
            saving={saveMutation.isPending}
            previewOrigin={previewOrigin}
          />
        ) : (
          <CustomerSurveySettingsPanelDesktop
            draft={draft}
            setDraft={setDraft}
            onSave={handleSave}
            saving={saveMutation.isPending}
            previewOrigin={previewOrigin}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDraft(defaults)}>
            {t("omnichannel.settings.customerSurvey.resetDefaults")}
          </Button>
        </div>
      </div>
    </div>
  );
}
