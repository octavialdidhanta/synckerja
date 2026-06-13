import { useTranslation } from "react-i18next";
import { TikTokShopHeaderAndTab } from "@/6-0-tiktok-shop/container/TikTokShopHeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { TikTokShopSettingsPanel } from "@/tiktok-shop/settings/TikTokShopSettingsPanel";
import {
  TIKTOK_SHOP_PAGE_PATH,
  TIKTOK_SHOP_SETTINGS_PATH,
} from "@/tiktok-shop/settings/tiktokShopSettingsPaths";
import { TikTokShopSettingsPageSkeleton } from "@/6-0-tiktok-shop/skeletons/TikTokShopSettingsPageSkeleton";

const PAGE_PATH = TIKTOK_SHOP_PAGE_PATH;

export default function TikTokShopSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokShopSettingsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={PAGE_PATH}>
      <TikTokShopSettingsPageContent />
    </ModuleShellContentGate>
  );
}

function TikTokShopSettingsPageContent() {
  const { t } = useTranslation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();

  if (gatePending) return <TikTokShopSettingsPageSkeleton />;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <TikTokShopHeaderAndTab />
            </div>
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
            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
