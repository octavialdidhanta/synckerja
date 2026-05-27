import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Columns3, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { DateRangeFilter } from "@/5-3-dashboard/components/leads/filters/DateRangeFilter";
import { useOmnichannelSurveySettingsAdmin } from "@/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useGoogleAdsReportingEnabled } from "@/google-ads/hooks/useGoogleAdsReportingEnabled";
import { useGoogleAdsMetricCatalog } from "@/google-ads/hooks/useGoogleAdsMetricCatalog";
import { useGoogleAdsMetrics } from "@/google-ads/hooks/useGoogleAdsMetrics";
import { useGoogleAdsMetricsPreferences } from "@/google-ads/hooks/useGoogleAdsMetricsPreferences";
import { MetricsPickerDialog } from "@/6-0-google-ads/components/MetricsPickerDialog";
import { GoogleAdsMetricsTable } from "@/6-0-google-ads/components/GoogleAdsMetricsTable";
import type { GoogleAdsMetricEntity, GoogleAdsMetricsSort } from "@/google-ads/metrics/types";
import { isUnsupportedMetricsError } from "@/google-ads/lib/parseEdgeFunctionError";
import { useGoogleAdsSettings } from "@/google-ads/hooks/useGoogleAdsSettings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "sonner";

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DateRangePreset = "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "custom";

function buildDateRangePayload(
  preset: DateRangePreset,
  customRange: DateRange | null,
): { preset?: string; start?: string; end?: string } {
  if (preset === "TODAY") {
    const ymd = toYmdLocal(new Date());
    return { preset: "TODAY", start: ymd, end: ymd };
  }
  if (preset === "LAST_7_DAYS") return { preset: "LAST_7_DAYS" };
  if (preset === "LAST_30_DAYS") return { preset: "LAST_30_DAYS" };
  if (customRange?.from && customRange?.to) {
    return { start: toYmdLocal(customRange.from), end: toYmdLocal(customRange.to) };
  }
  const ymd = toYmdLocal(new Date());
  return { preset: "TODAY", start: ymd, end: ymd };
}

export default function GoogleAdsMetricsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useGoogleAdsReportingEnabled(organizationId);
  const { syncAccessibleAccounts } = useGoogleAdsSettings(organizationId);

  const [entity, setEntity] = useState<GoogleAdsMetricEntity>("campaign");
  const [customerId, setCustomerId] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("TODAY");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [onlyRunning, setOnlyRunning] = useState(true);
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [pageToken, setPageToken] = useState("");
  const [pageTokenHistory, setPageTokenHistory] = useState<string[]>([]);
  const [sort, setSort] = useState<GoogleAdsMetricsSort>({ field: "spent", direction: "desc" });
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [unsupportedBannerLabels, setUnsupportedBannerLabels] = useState<string[] | null>(
    null,
  );
  const strippedUnsupportedRef = useRef<string | null>(null);

  const resetPagination = () => {
    setPageToken("");
    setPageTokenHistory([]);
  };

  const { data: catalogData } = useGoogleAdsMetricCatalog(
    organizationId,
    entity,
    canManage && reportingEnabled,
  );

  const validMetricKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of catalogData?.categories ?? []) {
      for (const m of c.metrics) keys.add(m.key);
    }
    return keys.size > 0 ? keys : null;
  }, [catalogData]);

  const metricLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catalogData?.categories ?? []) {
      for (const m of c.metrics) map.set(m.key, m.label);
    }
    return map;
  }, [catalogData]);

  const { selectedMetrics, save: saveMetrics, isPending: prefsPending } =
    useGoogleAdsMetricsPreferences(organizationId, entity, validMetricKeys);

  const { data: accounts = [], isPending: accountsPending } = useQuery({
    queryKey: ["google-ads-accounts-picker-metrics", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organization_google_ads_accounts")
        .select("id, label, customer_id, is_default")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(organizationId) && canManage,
  });

  const effectiveCustomerId = useMemo(() => {
    if (customerId) return customerId;
    const def = accounts.find((a) => a.is_default);
    return def?.customer_id ?? accounts[0]?.customer_id ?? "";
  }, [customerId, accounts]);

  const dateRangePayload = useMemo(
    () => buildDateRangePayload(datePreset, customRange),
    [datePreset, customRange],
  );

  const sortOptions = useMemo(() => {
    const cats = catalogData?.categories ?? [];
    const opts: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const c of cats) {
      for (const m of c.metrics) {
        if (m.sortable !== false && !seen.has(m.key)) {
          seen.add(m.key);
          opts.push({ key: m.key, label: m.label });
        }
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [catalogData]);

  useEffect(() => {
    if (sortOptions.length === 0) return;
    setSort((current) => {
      if (sortOptions.some((o) => o.key === current.field)) return current;
      const spent = sortOptions.find((o) => o.key === "spent");
      return { field: spent?.key ?? sortOptions[0]!.key, direction: "desc" };
    });
  }, [entity, sortOptions]);

  useEffect(() => {
    strippedUnsupportedRef.current = null;
    setUnsupportedBannerLabels(null);
  }, [entity, effectiveCustomerId]);

  const metricItems = useMemo(() => {
    const cats = catalogData?.categories ?? [];
    const map = new Map<string, (typeof cats)[0]["metrics"][0]>();
    for (const c of cats) {
      for (const m of c.metrics) map.set(m.key, m);
    }
    return selectedMetrics
      .map((k) => map.get(k))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }, [catalogData, selectedMetrics]);

  const metricsQuery = useGoogleAdsMetrics(
    organizationId,
    effectiveCustomerId
      ? {
          customerId: effectiveCustomerId,
          entity,
          metrics: selectedMetrics,
          dateRange: dateRangePayload,
          onlyRunning,
          statusFilter: enabledOnly ? "enabled_only" : "all",
          pageToken,
          sort,
        }
      : null,
    canManage && reportingEnabled && !prefsPending,
  );

  const handleApplyMetrics = async (keys: string[]) => {
    try {
      await saveMetrics.mutateAsync(keys);
      resetPagination();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    const error = metricsQuery.error;
    if (!isUnsupportedMetricsError(error)) {
      setUnsupportedBannerLabels(null);
      return;
    }
    const sig = error.unsupported_metrics.slice().sort().join("|");
    if (strippedUnsupportedRef.current === sig) return;
    strippedUnsupportedRef.current = sig;

    const labels = error.unsupported_metrics.map((k) => metricLabelByKey.get(k) ?? k);
    setUnsupportedBannerLabels(labels);
    toast.warning(
      t("digitalMarketing.googleAds.unsupportedMetricsToast", {
        defaultValue: "Some metrics are not available for this view and were removed.",
        count: labels.length,
      }),
    );

    const next = selectedMetrics.filter((k) => !error.unsupported_metrics.includes(k));
    if (next.length > 0 && next.length !== selectedMetrics.length) {
      void saveMetrics.mutateAsync(next);
    }
  }, [
    metricsQuery.error,
    metricLabelByKey,
    selectedMetrics,
    saveMetrics,
    t,
  ]);

  const handleSyncAccounts = async () => {
    try {
      const result = await syncAccessibleAccounts.mutateAsync();
      const imported = result.imported ?? 0;
      const skipped = result.skipped?.length ?? 0;
      if (imported > 0) {
        toast.success(
          t("digitalMarketing.googleAds.syncImported", {
            defaultValue: "Imported {{count}} account(s) from Google.",
            count: imported,
          }),
        );
      } else if (skipped > 0) {
        toast.message(
          t("digitalMarketing.googleAds.syncNoneImported", {
            defaultValue: "No new accounts imported. {{skipped}} skipped (check conversion actions or developer token).",
            skipped,
          }),
        );
      } else {
        toast.message(
          t("digitalMarketing.googleAds.syncUpToDate", {
            defaultValue: "All accessible Google Ads accounts are already linked.",
          }),
        );
      }
      void queryClient.invalidateQueries({
        queryKey: ["google-ads-accounts-picker-metrics", organizationId],
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const err = metricsQuery.error as (Error & { code?: string }) | null;
  const showTokenDenied =
    err?.code === "DEVELOPER_TOKEN_NOT_APPROVED" ||
    /DEVELOPER_TOKEN_NOT_APPROVED/i.test(err?.message ?? "") ||
    /developer token.*test account|only approved for use with test/i.test(err?.message ?? "");
  const showReconnectOAuth =
    err?.code === "TOKEN_REFRESH_FAILED" ||
    /invalid_grant|token refresh|TOKEN_REFRESH/i.test(err?.message ?? "");

  if (gatePending) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <ModuleShellContentGate pagePath="/digital-marketing/google-ads">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <div className="flex h-full min-h-0 flex-col">
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-h-full flex-col">
                  <div className="mb-1 min-w-0 shrink-0">
                    <HeaderAndTab />
                  </div>

                  <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                    <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                      {!canManage ? (
                        <div className="p-6">
                          <Alert>
                            <AlertTitle>
                              {t("digitalMarketing.googleAds.accessDeniedTitle", "Access restricted")}
                            </AlertTitle>
                            <AlertDescription>
                              {t(
                                "digitalMarketing.googleAds.accessDeniedBody",
                                "Only the organization owner or an omnichannel admin can view Google Ads metrics.",
                              )}{" "}
                              <Link
                                to="/omnichannel/settings/google-ads"
                                className="font-medium text-primary underline"
                              >
                                {t("digitalMarketing.googleAds.settingsLink", "Google Ads settings")}
                              </Link>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ) : (
                        <>
                          <div className="shrink-0 space-y-3 border-b border-gray-200 p-4">

                            {!reportingPending && !reportingEnabled ? (
                              <Alert>
                                <AlertTitle>
                                  {t("digitalMarketing.googleAds.notConnectedTitle", "Not connected")}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.notConnectedBody",
                                    "Connect Google Ads and add at least one customer account.",
                                  )}{" "}
                                  <Link
                                    to="/omnichannel/settings/google-ads"
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.settingsLink", "Settings")}
                                  </Link>
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {showTokenDenied ? (
                              <Alert variant="destructive">
                                <AlertTitle>
                                  {t(
                                    "digitalMarketing.googleAds.tokenNotApprovedTitle",
                                    "Developer token not approved",
                                  )}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.tokenNotApprovedBody",
                                    "Your Google Ads API developer token is approved for test accounts only. Apply for Basic or Standard access to use production accounts.",
                                  )}{" "}
                                  <a
                                    href="https://ads.google.com/aw/apicenter"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.apiCenterLink", "API Center")}
                                  </a>
                                  {" · "}
                                  <Link
                                    to="/omnichannel/settings/google-ads"
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.settingsLink", "Settings")}
                                  </Link>
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {unsupportedBannerLabels && unsupportedBannerLabels.length > 0 ? (
                              <Alert>
                                <AlertTitle>
                                  {t(
                                    "digitalMarketing.googleAds.unsupportedMetricsTitle",
                                    "Metrics adjusted",
                                  )}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.unsupportedMetricsBody",
                                    "These metrics are not supported for the current tab or account and were removed:",
                                  )}{" "}
                                  {unsupportedBannerLabels.join(", ")}
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {showReconnectOAuth ? (
                              <Alert variant="destructive">
                                <AlertTitle>
                                  {t(
                                    "digitalMarketing.googleAds.oauthExpiredTitle",
                                    "Google Ads connection expired",
                                  )}
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    "digitalMarketing.googleAds.oauthExpiredBody",
                                    "Reconnect Google Ads in settings to refresh access.",
                                  )}{" "}
                                  <Link
                                    to="/omnichannel/settings/google-ads"
                                    className="font-medium text-primary underline"
                                  >
                                    {t("digitalMarketing.googleAds.settingsLink", "Settings")}
                                  </Link>
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            <div className="flex min-w-0 flex-col gap-2">
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">
                                  {t("digitalMarketing.googleAds.title", "Google Ads performance")}
                                </h2>

                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                  <Label className="sr-only">
                                    {t("digitalMarketing.googleAds.dateRangeLabel", "Date range")}
                                  </Label>
                                  <Select
                                    value={datePreset}
                                    onValueChange={(v) => {
                                      setDatePreset(v as typeof datePreset);
                                      resetPagination();
                                      if (v !== "custom") setCustomRange(null);
                                    }}
                                  >
                                    <SelectTrigger className="h-9 w-[120px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TODAY">
                                        {t("digitalMarketing.googleAds.dateToday", "Today")}
                                      </SelectItem>
                                      <SelectItem value="LAST_7_DAYS">
                                        {t("digitalMarketing.googleAds.dateLast7", "Last 7 days")}
                                      </SelectItem>
                                      <SelectItem value="LAST_30_DAYS">
                                        {t("digitalMarketing.googleAds.dateLast30", "Last 30 days")}
                                      </SelectItem>
                                      <SelectItem value="custom">
                                        {t("digitalMarketing.googleAds.dateCustom", "Custom")}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Label className="sr-only">
                                    {t("digitalMarketing.googleAds.sortBy", "Sort by")}
                                  </Label>
                                  <Select
                                    value={sort.field}
                                    onValueChange={(field) => {
                                      setSort((s) => ({ ...s, field }));
                                      resetPagination();
                                    }}
                                    disabled={sortOptions.length === 0}
                                  >
                                    <SelectTrigger className="h-9 w-[100px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sortOptions.map((o) => (
                                        <SelectItem key={o.key} value={o.key}>
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={sort.direction}
                                    onValueChange={(direction) => {
                                      setSort((s) => ({
                                        ...s,
                                        direction: direction as "asc" | "desc",
                                      }));
                                      resetPagination();
                                    }}
                                  >
                                    <SelectTrigger className="h-9 w-[108px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="desc">
                                        {t("digitalMarketing.googleAds.sortDesc", "High → low")}
                                      </SelectItem>
                                      <SelectItem value="asc">
                                        {t("digitalMarketing.googleAds.sortAsc", "Low → high")}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Switch
                                      id="only-running"
                                      className="scale-90"
                                      checked={onlyRunning}
                                      onCheckedChange={(c) => {
                                        setOnlyRunning(c);
                                        resetPagination();
                                      }}
                                    />
                                    <Label
                                      htmlFor="only-running"
                                      className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground"
                                      title={t(
                                        "digitalMarketing.googleAds.onlyRunning",
                                        "Only with delivery (impressions or cost)",
                                      )}
                                    >
                                      {t("digitalMarketing.googleAds.onlyRunningShort", "Delivery")}
                                    </Label>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <Switch
                                      id="enabled-only"
                                      className="scale-90"
                                      checked={enabledOnly}
                                      onCheckedChange={(c) => {
                                        setEnabledOnly(c);
                                        resetPagination();
                                      }}
                                    />
                                    <Label
                                      htmlFor="enabled-only"
                                      className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground"
                                      title={t(
                                        "digitalMarketing.googleAds.enabledOnly",
                                        "Enabled status only",
                                      )}
                                    >
                                      {t("digitalMarketing.googleAds.enabledOnlyShort", "Enabled")}
                                    </Label>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 shrink-0"
                                    onClick={() => setMetricsDialogOpen(true)}
                                    disabled={!reportingEnabled}
                                  >
                                    <Columns3 className="mr-2 h-4 w-4" />
                                    {t("digitalMarketing.googleAds.metricsButton", "Metrics")}
                                  </Button>
                                </div>
                              </div>

                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <div className="flex shrink-0 items-center gap-1">
                                  <Label className="sr-only">
                                    {t("digitalMarketing.googleAds.customerLabel", "Account")}
                                  </Label>
                                  <Select
                                    value={effectiveCustomerId || undefined}
                                    onValueChange={(v) => {
                                      setCustomerId(v);
                                      resetPagination();
                                    }}
                                    disabled={accountsPending || accounts.length === 0}
                                  >
                                    <SelectTrigger className="h-9 w-[min(180px,40vw)]">
                                      <SelectValue
                                        placeholder={t(
                                          "digitalMarketing.googleAds.customerPlaceholder",
                                          "Select customer",
                                        )}
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {accounts.map((a) => (
                                        <SelectItem key={a.id} value={a.customer_id}>
                                          {a.label || a.customer_id}
                                          {a.is_default ? " (default)" : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title={t(
                                      "digitalMarketing.googleAds.syncFromGoogle",
                                      "Sync accounts from Google",
                                    )}
                                    disabled={
                                      !reportingEnabled || syncAccessibleAccounts.isPending
                                    }
                                    onClick={() => void handleSyncAccounts()}
                                  >
                                    {syncAccessibleAccounts.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>

                                <Tabs
                                  value={entity}
                                  onValueChange={(v) => {
                                    setEntity(v as GoogleAdsMetricEntity);
                                    resetPagination();
                                  }}
                                  className="shrink-0"
                                >
                                  <TabsList className="h-9">
                                    <TabsTrigger value="campaign" className="px-3 text-xs sm:text-sm">
                                      Campaign
                                    </TabsTrigger>
                                    <TabsTrigger value="ad_group" className="px-3 text-xs sm:text-sm">
                                      Ad group
                                    </TabsTrigger>
                                    <TabsTrigger value="ad" className="px-3 text-xs sm:text-sm">
                                      Ad
                                    </TabsTrigger>
                                  </TabsList>
                                </Tabs>
                              </div>

                              {datePreset === "custom" ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <DateRangeFilter
                                    defaultPreset="last30days"
                                    onDateRangeChange={(range) => {
                                      setCustomRange(range);
                                      resetPagination();
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>

                            {metricsQuery.data?.currency_code ? (
                              <p className="text-xs text-muted-foreground">
                                {t("digitalMarketing.googleAds.currency", "Currency")}:{" "}
                                <span className="font-medium">{metricsQuery.data.currency_code}</span>
                                {metricsQuery.data.date_range ? (
                                  <>
                                    {" · "}
                                    {format(
                                      new Date(metricsQuery.data.date_range.start),
                                      "dd MMM yyyy",
                                    )}{" "}
                                    –{" "}
                                    {format(
                                      new Date(metricsQuery.data.date_range.end),
                                      "dd MMM yyyy",
                                    )}
                                  </>
                                ) : null}
                                {metricsQuery.data.cached ? (
                                  <span className="ml-2 text-muted-foreground/80">(cached)</span>
                                ) : null}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="scrollbar-hide min-h-0 flex-1 overflow-auto p-4 pb-2">
                              {metricsQuery.isError &&
                              !showTokenDenied &&
                              !showReconnectOAuth &&
                              !isUnsupportedMetricsError(metricsQuery.error) ? (
                                <Alert variant="destructive" className="mb-4">
                                  <AlertDescription>
                                    {(metricsQuery.error as Error).message}
                                  </AlertDescription>
                                </Alert>
                              ) : null}

                              <GoogleAdsMetricsTable
                                entity={entity}
                                rows={metricsQuery.data?.rows ?? []}
                                metricItems={metricItems}
                                currencyCode={metricsQuery.data?.currency_code ?? null}
                                isLoading={metricsQuery.isLoading || metricsQuery.isFetching}
                              />
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 bg-white px-4 py-3">
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    pageTokenHistory.length === 0 || metricsQuery.isFetching
                                  }
                                  onClick={() => {
                                    setPageTokenHistory((h) => {
                                      if (h.length === 0) return h;
                                      const prev = h[h.length - 1] ?? "";
                                      setPageToken(prev);
                                      return h.slice(0, -1);
                                    });
                                  }}
                                >
                                  <ChevronLeft className="mr-1 h-4 w-4" />
                                  {t("common.previous", "Previous")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    (pageTokenHistory.length === 0 && !pageToken) ||
                                    metricsQuery.isFetching
                                  }
                                  onClick={resetPagination}
                                >
                                  {t("common.firstPage", "First page")}
                                </Button>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                  !metricsQuery.data?.next_page_token || metricsQuery.isFetching
                                }
                                onClick={() => {
                                  const next = metricsQuery.data?.next_page_token;
                                  if (!next) return;
                                  setPageTokenHistory((h) => [...h, pageToken]);
                                  setPageToken(next);
                                }}
                              >
                                {t("common.next", "Next")}
                                <ChevronRight className="ml-1 h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
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
        </div>
      </ModuleShellContentGate>

      <MetricsPickerDialog
        open={metricsDialogOpen}
        onOpenChange={setMetricsDialogOpen}
        categories={catalogData?.categories ?? []}
        selectedKeys={selectedMetrics}
        onApply={handleApplyMetrics}
        isSaving={saveMetrics.isPending}
      />
    </div>
  );
}
