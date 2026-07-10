import { useTranslation } from "react-i18next";
import { TikTokShopModuleShell } from "@/6-0-tiktok-shop/layout/TikTokShopModuleShell";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { TikTokShopSettingsPanel } from "@/tiktok-shop/settings/TikTokShopSettingsPanel";
import {
  TIKTOK_SHOP_SETTINGS_PATH,
} from "@/tiktok-shop/settings/tiktokShopSettingsPaths";
import { TikTokShopSettingsPageSkeleton } from "@/6-0-tiktok-shop/skeletons/TikTokShopSettingsPageSkeleton";

export default function TikTokShopSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokShopSettingsPageSkeleton />;
  return (
    <TikTokShopModuleShell>
      <TikTokShopSettingsPageContent />
    </TikTokShopModuleShell>
  );
}

function TikTokShopSettingsPageContent() {
  const { t } = useTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  if (gatePending) return null;

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 min-h-0 rounded-lg border border-gray-200 bg-white shadow-sm">
        {!canManage ? (
          <div className="p-4">
            <Alert>
              <AlertTitle>
                {t("digitalMarketing.tiktokShop.accessDeniedTitle", "Access restricted")}
              </AlertTitle>
              <AlertDescription>
                {t(
                  "digitalMarketing.tiktokShop.accessDeniedBody",
                  "Only the organization owner or an omnichannel admin can manage TikTok Shop connections.",
                )}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <TikTokShopSettingsPanel
            organizationId={organizationId}
            oauthReturnPath={TIKTOK_SHOP_SETTINGS_PATH}
          />
        )}
      </div>
    </div>
  );
}
