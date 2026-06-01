import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { omnichannelSettingsPath } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { GoogleAdsSettingsPanel } from "@/google-ads/settings/GoogleAdsSettingsPanel";
import { GOOGLE_ADS_OMNICHANNEL_SETTINGS_PATH } from "@/google-ads/settings/googleAdsSettingsPaths";
import { MetaAdsSettingsPanel } from "@/meta-ads/settings/MetaAdsSettingsPanel";
import { META_ADS_OMNICHANNEL_SETTINGS_PATH } from "@/meta-ads/settings/metaAdsSettingsPaths";

export function OfflineConversionSettingsShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  const platformTab = searchParams.get("platform") === "meta" ? "meta" : "google";

  useEffect(() => {
    if (!gatePending || !organizationId) return;
    if (!canManage) {
      toast.message(t("omnichannel.settings.offlineConversion.adminOnlyToast", "Only org owner or omnichannel admin can manage offline conversion settings."));
      navigate(omnichannelSettingsPath("user-management"), { replace: true });
    }
  }, [canManage, gatePending, navigate, organizationId, t]);

  const setPlatformTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "meta") next.set("platform", "meta");
    else next.delete("platform");
    setSearchParams(next, { replace: true });
  };

  if (gatePending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={OMNICHANNEL_SETTINGS_CARD_HEADER_BASE}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
        <div className="px-4 pb-4 pt-4 space-y-3">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!canManage) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`${OMNICHANNEL_SETTINGS_CARD_HEADER_BASE} shrink-0`}>
        <h2 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
          {t("omnichannel.settings.offlineConversion.pageTitle", "Offline Conversion")}
        </h2>
        <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
          {t(
            "omnichannel.settings.offlineConversion.intro",
            "Configure ad platforms that receive offline conversions when CRM leads become Converted.",
          )}
        </p>
      </div>

      <Tabs value={platformTab} onValueChange={setPlatformTab} className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
        </TabsList>
        <TabsContent value="google" className="flex-1 min-h-0 mt-4 data-[state=inactive]:hidden">
          <GoogleAdsSettingsPanel
            organizationId={organizationId}
            enabled={canManage && !gatePending}
            oauthReturnPath={GOOGLE_ADS_OMNICHANNEL_SETTINGS_PATH}
          />
        </TabsContent>
        <TabsContent value="meta" className="flex-1 min-h-0 mt-4 data-[state=inactive]:hidden">
          <MetaAdsSettingsPanel
            organizationId={organizationId}
            enabled={canManage && !gatePending}
            oauthReturnPath={META_ADS_OMNICHANNEL_SETTINGS_PATH}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
