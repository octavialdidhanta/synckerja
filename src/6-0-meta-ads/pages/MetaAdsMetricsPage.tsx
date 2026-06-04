import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Columns3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { useMetaAdsReportingEnabled } from "@/meta-ads/hooks/useMetaAdsReportingEnabled";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import {
  useMetaAdsMetricsQuery,
  type MetaAdsMetricEntity,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { MetaAdsSettingsPanel } from "@/meta-ads/settings/MetaAdsSettingsPanel";
import {
  META_ADS_DIGITAL_MARKETING_BASE_PATH,
  META_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/meta-ads/settings/metaAdsSettingsPaths";
import { MetaAdsMetricsPageSkeleton } from "@/6-0-meta-ads/skeletons/MetaAdsMetricsPageSkeleton";
import { MetaAdsEntityNav, type MetaAdsNavAccount } from "@/6-0-meta-ads/components/MetaAdsEntityNav";
import { MetaAdsMetricsSummaryBar } from "@/6-0-meta-ads/components/MetaAdsMetricsSummaryBar";
import { MetaAdsMetricsTable } from "@/6-0-meta-ads/components/MetaAdsMetricsTable";
import { MetaAdsMetricsTableFooter } from "@/6-0-meta-ads/components/MetaAdsMetricsTableFooter";
import { MetaAdsModifyColumnsDialog } from "@/6-0-meta-ads/components/MetaAdsModifyColumnsDialog";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import { useMetaAdsMetricsPreferences } from "@/meta-ads/hooks/useMetaAdsMetricsPreferences";
import {
  buildMetaAdsMetricCatalogResponse,
  getMetaAdsCatalogMetricKeys,
  resolveMetaAdsMetricItems,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
import { toMetaAdsMetricsDateRangePayload } from "@/meta-ads/lib/toMetaAdsMetricsDateRangePayload";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  buildMetaAdsSortColumnOptions,
  defaultMetaAdsSortDirection,
  getMetaAdsSortColumnKind,
  resolveSortForOptions,
  type MetaAdsMetricsSort,
} from "@/meta-ads/metrics/metaAdsSortColumns";
import { sortMetaAdsRows } from "@/meta-ads/metrics/sortMetaAdsRows";

export default function MetaAdsMetricsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <MetaAdsMetricsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath="/digital-marketing/meta-ads">
      <MetaAdsMetricsPageContent />
    </ModuleShellContentGate>
  );
}

function MetaAdsMetricsPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsView = location.pathname === META_ADS_DIGITAL_MARKETING_SETTINGS_PATH;
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useMetaAdsReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const { dateSelection, setDateSelection, metaAdAccountId, setMetaAdAccountId } =
    useDigitalMarketingPaidAdsFilters();
  const [entity, setEntity] = useState<MetaAdsMetricEntity>("campaign");
  const adAccountId = metaAdAccountId;
  const setAdAccountId = setMetaAdAccountId;
  const [sort, setSort] = useState<MetaAdsMetricsSort>({ field: "spend", direction: "desc" });
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const sortHydratedForEntityRef = useRef<string | null>(null);

  const validMetricKeys = useMemo(() => getMetaAdsCatalogMetricKeys(), []);
  const catalogData = useMemo(() => buildMetaAdsMetricCatalogResponse(entity), [entity]);

  const {
    visibleColumns: selectedMetrics,
    storedSort,
    isPending: prefsPending,
    save: saveMetrics,
    saveSort,
  } = useMetaAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  const dateRange = useMemo(
    () => toMetaAdsMetricsDateRangePayload(dateSelection),
    [dateSelection],
  );
  const dateStart = dateRange.start;
  const dateEnd = dateRange.end;

  const allActiveAccounts = useMemo(
    () => (settings?.accounts ?? []).filter((a) => a.is_active),
    [settings?.accounts],
  );

  /** Accounts with a real Pixel ID — required for insights API and CAPI. */
  const metricsReadyAccounts = useMemo(
    () => allActiveAccounts.filter((a) => a.pixel_id !== "0"),
    [allActiveAccounts],
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
    if (!adAccountId && metricsReadyAccounts.length > 0) {
      const def = metricsReadyAccounts.find((a) => a.is_default) ?? metricsReadyAccounts[0];
      setMetaAdAccountId(def.ad_account_id);
    }
  }, [metricsReadyAccounts, adAccountId, setMetaAdAccountId]);

  const metricItems = useMemo(
    () => resolveMetaAdsMetricItems(selectedMetrics, entity),
    [selectedMetrics, entity],
  );

  const sortColumnOptions = useMemo(
    () => buildMetaAdsSortColumnOptions(entity, selectedMetrics),
    [entity, selectedMetrics],
  );

  useEffect(() => {
    sortHydratedForEntityRef.current = null;
  }, [entity, organizationId]);

  useEffect(() => {
    if (prefsPending || sortColumnOptions.length === 0) return;
    if (sortHydratedForEntityRef.current === entity) return;
    sortHydratedForEntityRef.current = entity;
    setSort(resolveSortForOptions(storedSort, sortColumnOptions));
  }, [prefsPending, storedSort, sortColumnOptions, entity]);

  useEffect(() => {
    if (sortColumnOptions.length === 0) return;
    setSort((current) => {
      const next = resolveSortForOptions(current, sortColumnOptions);
      if (next.field === current.field && next.direction === current.direction) return current;
      return next;
    });
  }, [sortColumnOptions]);

  const metricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity,
    dateStart,
    dateEnd,
    enabled:
      reportingEnabled &&
      Boolean(adAccountId) &&
      metricsReadyAccounts.some((a) => a.ad_account_id === adAccountId) &&
      !isSettingsView &&
      canManage,
  });

  const sortFieldValue = useMemo(() => {
    if (sortColumnOptions.some((o) => o.key === sort.field)) return sort.field;
    return sortColumnOptions[0]?.key ?? "spend";
  }, [sort.field, sortColumnOptions]);

  const sortedRows = useMemo(() => {
    const rows = metricsQuery.data?.rows ?? [];
    return sortMetaAdsRows(rows, { field: sortFieldValue, direction: sort.direction }, entity);
  }, [metricsQuery.data?.rows, sortFieldValue, sort.direction, entity]);

  const handleSortFieldChange = (field: string) => {
    const kind = getMetaAdsSortColumnKind(field);
    const next: MetaAdsMetricsSort = {
      field,
      direction: defaultMetaAdsSortDirection(kind),
    };
    setSort(next);
    void saveSort.mutateAsync(next);
  };

  const handleSortDirectionChange = (direction: "asc" | "desc") => {
    const next: MetaAdsMetricsSort = { field: sortFieldValue, direction };
    setSort(next);
    void saveSort.mutateAsync(next);
  };

  const handleApplyMetrics = async (keys: string[]) => {
    try {
      const itemsAfterApply = resolveMetaAdsMetricItems(keys, entity);
      const optionsAfterApply = buildMetaAdsSortColumnOptions(
        entity,
        itemsAfterApply.map((m) => m.key),
      );
      const nextSort = resolveSortForOptions(sort, optionsAfterApply);
      setSort(nextSort);
      await saveMetrics.mutateAsync({ visibleColumns: keys, sort: nextSort });
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  const metricsTableLoading =
    metricsQuery.isLoading || (metricsQuery.isFetching && !metricsQuery.data);

  const accountSelectReady = !settingsPending && navAccounts.length > 0;
  const rawPageLoadPending = gatePending || reportingPending || (canManage && settingsPending);

  if (rawPageLoadPending) {
    return <MetaAdsMetricsPageSkeleton />;
  }

  return (
    <>
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>

                <div className="grid min-h-0 min-w-0 w-full flex-1 basis-0 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    {!canManage ? (
                      <div className="p-6">
                        <Alert>
                          <AlertTitle>
                            {t(
                              "digitalMarketing.metaAds.accessDeniedTitle",
                              "Access restricted",
                            )}
                          </AlertTitle>
                          <AlertDescription>
                            {t(
                              "digitalMarketing.metaAds.accessDeniedBody",
                              "Only the organization owner or an omnichannel admin can view Meta Ads metrics.",
                            )}{" "}
                            <Link
                              to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                              className="font-medium text-primary underline"
                            >
                              {t("digitalMarketing.metaAds.settingsLink", "Meta Ads settings")}
                            </Link>
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : (
                      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                        <MetaAdsEntityNav
                          entity={entity}
                          onEntityChange={(next) => {
                            setEntity(next);
                            if (isSettingsView) {
                              navigate(META_ADS_DIGITAL_MARKETING_BASE_PATH);
                            }
                          }}
                          accounts={navAccounts}
                          adAccountId={adAccountId}
                          accountSelectReady={accountSelectReady}
                          accountsPending={settingsPending}
                          onAdAccountIdChange={setAdAccountId}
                          settingsActive={isSettingsView}
                          onSettingsSelect={() =>
                            navigate(META_ADS_DIGITAL_MARKETING_SETTINGS_PATH)
                          }
                        />

                        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
                          {isSettingsView ? (
                            <MetaAdsSettingsPanel
                              organizationId={organizationId}
                              oauthReturnPath={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                              contentClassName="p-4"
                            />
                          ) : (
                            <>
                              <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
                                {!reportingPending && !reportingEnabled ? (
                                  <Alert>
                                    <AlertTitle>
                                      {t(
                                        "digitalMarketing.metaAds.notConnected",
                                        "Meta Ads not connected",
                                      )}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {t(
                                        "digitalMarketing.metaAds.notConnectedHint",
                                        "Connect Meta Ads in Offline Conversion settings to view metrics.",
                                      )}{" "}
                                      <Link
                                        to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                        className="font-medium text-primary underline"
                                      >
                                        {t(
                                          "digitalMarketing.metaAds.settingsLink",
                                          "Settings",
                                        )}
                                      </Link>
                                    </AlertDescription>
                                  </Alert>
                                ) : null}

                                {metricsReadyAccounts.length === 0 &&
                                allActiveAccounts.length > 0 &&
                                reportingEnabled ? (
                                  <Alert>
                                    <AlertTitle>
                                      {t(
                                        "digitalMarketing.metaAds.pixelRequiredTitle",
                                        "Pixel ID required",
                                      )}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {t(
                                        "digitalMarketing.metaAds.pixelRequiredHint",
                                        "Your ad accounts are synced but still use Pixel 0. Open Settings, click Edit on each account, and paste the Pixel ID from Meta Events Manager.",
                                      )}{" "}
                                      <Link
                                        to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                        className="font-medium text-primary underline"
                                      >
                                        {t(
                                          "digitalMarketing.metaAds.settingsLink",
                                          "Settings",
                                        )}
                                      </Link>
                                    </AlertDescription>
                                  </Alert>
                                ) : null}

                                {allActiveAccounts.length === 0 && reportingEnabled ? (
                                  <Alert>
                                    <AlertTitle>
                                      {t(
                                        "digitalMarketing.metaAds.noAccountsTitle",
                                        "No ad accounts ready",
                                      )}
                                    </AlertTitle>
                                    <AlertDescription>
                                      {t(
                                        "digitalMarketing.metaAds.noAccountsHint",
                                        "Sync ad accounts in Settings and set a Pixel ID for each account you want to report on.",
                                      )}{" "}
                                      <Link
                                        to={META_ADS_DIGITAL_MARKETING_SETTINGS_PATH}
                                        className="font-medium text-primary underline"
                                      >
                                        {t(
                                          "digitalMarketing.metaAds.settingsLink",
                                          "Settings",
                                        )}
                                      </Link>
                                    </AlertDescription>
                                  </Alert>
                                ) : null}

                                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title={t(
                                      "digitalMarketing.metaAds.refreshData",
                                      "Refresh metrics from Meta",
                                    )}
                                    disabled={
                                      !reportingEnabled ||
                                      !adAccountId ||
                                      metricsQuery.isFetching
                                    }
                                    onClick={() => void metricsQuery.refetch()}
                                  >
                                    {metricsQuery.isFetching ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>

                                  <GoogleAdsDateRangePicker
                                    value={dateSelection}
                                    onChange={setDateSelection}
                                  />

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 shrink-0"
                                    disabled={!reportingEnabled || prefsPending}
                                    onClick={() => setMetricsDialogOpen(true)}
                                  >
                                    <Columns3 className="mr-2 h-4 w-4" />
                                    {t("digitalMarketing.metaAds.metricsButton", "Metrics")}
                                  </Button>
                                </div>
                              </div>

                              {reportingEnabled && adAccountId ? (
                                <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:pb-2">
                                  <MetaAdsMetricsSummaryBar
                                    summary={
                                      metricsTableLoading ? undefined : metricsQuery.data?.summary
                                    }
                                    isLoading={metricsTableLoading}
                                  />
                                </div>
                              ) : null}

                              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-gray-100">
                                <div className="shrink-0 space-y-1 px-4 pt-2 pb-1 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:pt-1.5">
                                  {metricsQuery.data?.summary?.currency ? (
                                    <p className="text-xs text-muted-foreground">
                                      {t("digitalMarketing.metaAds.currency", "Currency")}:{" "}
                                      <span className="font-medium">
                                        {metricsQuery.data.summary.currency}
                                      </span>
                                      {" · "}
                                      {format(new Date(dateStart), "dd MMM yyyy")} –{" "}
                                      {format(new Date(dateEnd), "dd MMM yyyy")}
                                      {metricsQuery.data.cached ? (
                                        <span className="ml-2 text-muted-foreground/80">
                                          ({t("digitalMarketing.metaAds.cached", "cached")})
                                        </span>
                                      ) : null}
                                    </p>
                                  ) : null}
                                  {dateRange.wasStartClamped ? (
                                    <p className="text-xs text-amber-800">
                                      {t(
                                        "digitalMarketing.metaAds.dateRangeClampedHint",
                                        "Meta only allows data from the last 37 months. The start date was adjusted automatically.",
                                      )}
                                    </p>
                                  ) : null}
                                </div>

                                {metricsQuery.isError ? (
                                  <div className="shrink-0 px-4 pb-2">
                                    <Alert variant="destructive">
                                      <AlertTitle>
                                        {t(
                                          "digitalMarketing.metaAds.error",
                                          "Failed to load metrics",
                                        )}
                                      </AlertTitle>
                                      <AlertDescription>
                                        {(metricsQuery.error as Error).message}
                                      </AlertDescription>
                                    </Alert>
                                  </div>
                                ) : null}

                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4">
                                  <div className="min-h-0 flex-1 overflow-hidden">
                                    <MetaAdsMetricsTable
                                      entity={entity}
                                      rows={sortedRows}
                                      metricItems={metricItems}
                                      currencyCode={
                                        metricsQuery.data?.summary?.currency ?? null
                                      }
                                      isLoading={metricsTableLoading}
                                    />
                                  </div>

                                  <MetaAdsMetricsTableFooter
                                    totalCount={sortedRows.length}
                                    sort={{ field: sortFieldValue, direction: sort.direction }}
                                    sortColumnOptions={sortColumnOptions}
                                    cached={metricsQuery.data?.cached}
                                    isLoading={metricsTableLoading}
                                    onSortFieldChange={handleSortFieldChange}
                                    onSortDirectionChange={handleSortDirectionChange}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <MetaAdsModifyColumnsDialog
        open={metricsDialogOpen}
        onOpenChange={setMetricsDialogOpen}
        entity={entity}
        catalog={catalogData}
        selectedKeys={selectedMetrics}
        onApply={handleApplyMetrics}
        isSaving={saveMetrics.isPending}
      />
    </>
  );
}
