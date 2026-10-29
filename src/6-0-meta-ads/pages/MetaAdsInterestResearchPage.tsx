import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import {
  META_ADS_DIGITAL_MARKETING_BASE_PATH,
  META_ADS_DIGITAL_MARKETING_BREAKDOWN_PATH,
  META_ADS_DIGITAL_MARKETING_INTEREST_RESEARCH_PATH,
  META_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/meta-ads/settings/metaAdsSettingsPaths";
import { MetaAdsInterestResearchPageSkeleton } from "@/6-0-meta-ads/skeletons/MetaAdsInterestResearchPageSkeleton";
import {
  MetaAdsEntityNav,
  type MetaAdsNavAccount,
  type MetaAdsNavView,
} from "@/6-0-meta-ads/components/MetaAdsEntityNav";
import { InterestResearchWorkspace } from "@/6-0-meta-ads/components/interest-research/InterestResearchWorkspace";
import { InterestResearchSavedPanel } from "@/6-0-meta-ads/components/interest-research/InterestResearchSavedPanel";
import type { PopulationBudgetSession } from "@/6-0-meta-ads/components/interest-research/population-budget";
import {
  InterestResearchReachPanel,
  type InterestResearchReachResult,
} from "@/6-0-meta-ads/components/interest-research/InterestResearchReachPanel";
import {
  InterestResearchOverlapPanel,
  type InterestResearchOverlapResult,
} from "@/6-0-meta-ads/components/interest-research/InterestResearchOverlapPanel";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import type {
  InterestResearchFilters,
  MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";

export default function MetaAdsInterestResearchPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ModuleHeaderBelowContentGate
            pagePath="/digital-marketing/meta-ads"
            header={<HeaderAndTab />}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            {orgBootstrapPending ? (
              <MetaAdsInterestResearchPageSkeleton includeHeader={false} />
            ) : (
              <MetaAdsInterestResearchPageContent />
            )}
          </ModuleHeaderBelowContentGate>
        </div>
      </div>
    </div>
  );
}

function MetaAdsInterestResearchPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: settings, isPending: settingsPending } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });
  const { metaAdAccountId, setMetaAdAccountId } = useDigitalMarketingPaidAdsFilters();
  const [loadedItems, setLoadedItems] = useState<MetaTargetingItem[] | null>(null);
  const [reachResult, setReachResult] = useState<InterestResearchReachResult | null>(null);
  const [overlapResult, setOverlapResult] = useState<InterestResearchOverlapResult | null>(null);
  const [researchFilters, setResearchFilters] = useState<InterestResearchFilters | null>(null);
  const [populationBudget, setPopulationBudget] = useState<PopulationBudgetSession | null>(null);
  const [selectedResearchItems, setSelectedResearchItems] = useState<MetaTargetingItem[]>([]);

  const oauthConnected = settings?.oauthConnected ?? false;
  const allActiveAccounts = useMemo(
    () => (oauthConnected ? (settings?.accounts ?? []).filter((a) => a.is_active) : []),
    [settings?.accounts, oauthConnected],
  );

  const navAccounts: MetaAdsNavAccount[] = useMemo(
    () =>
      allActiveAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        ad_account_id: a.ad_account_id,
        is_default: a.is_default,
        metricsReady: a.pixel_id !== "0",
      })),
    [allActiveAccounts],
  );

  useEffect(() => {
    if (!oauthConnected && metaAdAccountId) setMetaAdAccountId("");
  }, [oauthConnected, metaAdAccountId, setMetaAdAccountId]);

  /** Interest research: any active ad account — pixel not required. */
  useEffect(() => {
    if (!metaAdAccountId && allActiveAccounts.length > 0) {
      const def = allActiveAccounts.find((a) => a.is_default) ?? allActiveAccounts[0];
      setMetaAdAccountId(def.ad_account_id);
    }
  }, [allActiveAccounts, metaAdAccountId, setMetaAdAccountId]);

  const adAccountId = metaAdAccountId;
  const accountReady = Boolean(adAccountId) && allActiveAccounts.some((a) => a.ad_account_id === adAccountId);
  const accountSelectReady = !gatePending && canManage && oauthConnected && !settingsPending;

  const showSkeleton = gatePending || (canManage && settingsPending);

  const onEntityChange = useCallback(
    (next: MetaAdsNavView) => {
      if (next === "interest-research") {
        if (location.pathname !== META_ADS_DIGITAL_MARKETING_INTEREST_RESEARCH_PATH) {
          navigate(META_ADS_DIGITAL_MARKETING_INTEREST_RESEARCH_PATH);
        }
        return;
      }
      if (next === "breakdown") {
        navigate(META_ADS_DIGITAL_MARKETING_BREAKDOWN_PATH);
        return;
      }
      navigate(META_ADS_DIGITAL_MARKETING_BASE_PATH);
    },
    [navigate, location.pathname],
  );

  const clearLoaded = useCallback(() => setLoadedItems(null), []);

  if (showSkeleton) return <MetaAdsInterestResearchPageSkeleton includeHeader={false} />;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <MetaAdsEntityNav
        entity="interest-research"
        onEntityChange={onEntityChange}
        accounts={navAccounts}
        adAccountId={adAccountId}
        accountSelectReady={accountSelectReady}
        accountsPending={settingsPending}
        onAdAccountIdChange={setMetaAdAccountId}
        allowAccountsWithoutPixel
        onSettingsSelect={() => navigate(META_ADS_DIGITAL_MARKETING_SETTINGS_PATH)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!canManage ? (
          <div className="p-6">
            <Alert>
              <AlertTitle>
                {t("digitalMarketing.metaAds.accessDeniedTitle", "Access restricted")}
              </AlertTitle>
              <AlertDescription>
                {t(
                  "digitalMarketing.metaAds.accessDeniedBody",
                  "Only the organization owner or an omnichannel admin can view Meta Ads metrics.",
                )}
              </AlertDescription>
            </Alert>
          </div>
        ) : !oauthConnected ? (
          <div className="p-6">
            <Alert>
              <AlertTitle>
                {t("digitalMarketing.metaAds.notConnected", "Meta Ads not connected")}
              </AlertTitle>
              <AlertDescription>
                {t(
                  "digitalMarketing.metaAds.interestConnectHint",
                  "Connect Meta Ads and select an ad account to research interests. Pixel is not required.",
                )}{" "}
                <Link
                  to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                  className="font-medium text-primary underline"
                >
                  {t("digitalMarketing.metaAds.settingsLink", "Settings")}
                </Link>
              </AlertDescription>
            </Alert>
          </div>
        ) : allActiveAccounts.length === 0 ? (
          <div className="p-6">
            <Alert>
              <AlertTitle>
                {t("digitalMarketing.metaAds.noAccountsTitle", "No ad accounts")}
              </AlertTitle>
              <AlertDescription>
                {t(
                  "digitalMarketing.metaAds.noAccountsHint",
                  "Sync or add an ad account in Settings.",
                )}{" "}
                <Link
                  to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                  className="font-medium text-primary underline"
                >
                  {t("digitalMarketing.metaAds.settingsLink", "Settings")}
                </Link>
              </AlertDescription>
            </Alert>
          </div>
        ) : !accountReady ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            {t("digitalMarketing.metaAds.breakdownSelectAccount", "Select an ad account")}
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            <InterestResearchWorkspace
              organizationId={organizationId!}
              adAccountId={adAccountId}
              externalItems={loadedItems}
              onExternalItemsConsumed={clearLoaded}
              onReachResultChange={setReachResult}
              onOverlapResultChange={setOverlapResult}
              onResearchFiltersChange={setResearchFilters}
              populationBudget={populationBudget}
              onClosePopulationBudget={() => setPopulationBudget(null)}
              onSelectedItemsChange={setSelectedResearchItems}
            />
            <aside className="hidden h-full min-h-0 w-[320px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white xl:flex">
              <InterestResearchSavedPanel
                organizationId={organizationId!}
                adAccountId={adAccountId}
                filters={researchFilters}
                onLoadItems={setLoadedItems}
                onCalculatePopulation={setPopulationBudget}
                selectedItems={selectedResearchItems}
                topContent={
                  reachResult || overlapResult ? (
                    <div className="space-y-3">
                      {reachResult ? <InterestResearchReachPanel result={reachResult} /> : null}
                      {overlapResult ? (
                        <InterestResearchOverlapPanel result={overlapResult} variant="rail" />
                      ) : null}
                    </div>
                  ) : null
                }
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
