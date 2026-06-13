import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { endOfDay } from "date-fns";
import { toast } from "sonner";
import { TikTokShopHeaderAndTab } from "@/6-0-tiktok-shop/container/TikTokShopHeaderAndTab";
import { TikTokShopShopNav } from "@/6-0-tiktok-shop/container/TikTokShopShopNav";
import { TikTokShopDashboardSummaryBar } from "@/6-0-tiktok-shop/container/TikTokShopDashboardSummaryBar";
import { TikTokShopOrderStatusFilter } from "@/6-0-tiktok-shop/container/TikTokShopOrderStatusFilter";
import { TikTokShopOrdersTable } from "@/6-0-tiktok-shop/container/TikTokShopOrdersTable";
import { TikTokShopOrderDetailDrawer } from "@/6-0-tiktok-shop/container/TikTokShopOrderDetailDrawer";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { TikTokAdsDateRangePicker } from "@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker";
import {
  computePresetRange,
  parseYmdLocal,
  toYmdLocal,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  buildTikTokShopCalendarYearPresetYears,
  clampTikTokShopDateRange,
} from "@/tiktok-shop/lib/clampTikTokShopDateRange";
import { useTikTokShopReportingEnabled } from "@/tiktok-shop/hooks/useTikTokShopReportingEnabled";
import { useTikTokShopSettings } from "@/tiktok-shop/hooks/useTikTokShopSettings";
import {
  fetchTikTokShopOrders,
  useTikTokShopOrdersQuery,
} from "@/tiktok-shop/hooks/useTikTokShopOrdersQuery";
import {
  fetchTikTokShopPeriodSummary,
  useTikTokShopPeriodSummaryQuery,
} from "@/tiktok-shop/hooks/useTikTokShopPeriodSummaryQuery";
import { exportTikTokShopOrdersCsv } from "@/tiktok-shop/lib/exportTikTokShopOrdersCsv";
import { pollTikTokOrdersForStock } from "@/stock-management/lib/inventoryApi";
import type { TikTokAdsEdgeError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import {
  TIKTOK_SHOP_PAGE_PATH,
  TIKTOK_SHOP_SETTINGS_PATH,
} from "@/tiktok-shop/settings/tiktokShopSettingsPaths";
import { TikTokShopDashboardPageSkeleton } from "@/6-0-tiktok-shop/skeletons/TikTokShopDashboardPageSkeleton";

const PAGE_PATH = TIKTOK_SHOP_PAGE_PATH;

function initialDateSelection(): GoogleAdsDateRangeSelection {
  const range = computePresetRange("last_30_days", new Date());
  return { preset: "last_30_days", range };
}

function dateRangeFromSelection(selection: GoogleAdsDateRangeSelection): {
  start: string;
  end: string;
} {
  const from = selection.range.from;
  const to = selection.range.to;
  const start = from ? toYmdLocal(from) : clampTikTokShopDateRange("", "").start;
  const end = to ? toYmdLocal(endOfDay(to)) : clampTikTokShopDateRange("", "").end;
  return clampTikTokShopDateRange(start, end);
}

export default function TikTokShopDashboardPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokShopDashboardPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={PAGE_PATH}>
      <TikTokShopDashboardPageContent />
    </ModuleShellContentGate>
  );
}

function TikTokShopDashboardPageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokShopReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokShopSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const [dateSelection, setDateSelection] = useState<GoogleAdsDateRangeSelection>(initialDateSelection);
  const [shopAccountId, setShopAccountId] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [pageTokenHistory, setPageTokenHistory] = useState<string[]>([""]);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const shops = useMemo(
    () =>
      (settings?.sellers ?? []).flatMap((seller) =>
        seller.shops.filter((shop) => shop.is_active),
      ),
    [settings],
  );

  useEffect(() => {
    if (shopAccountId || shops.length === 0) return;
    const preferred = shops.find((shop) => shop.is_default) ?? shops[0];
    if (preferred) setShopAccountId(preferred.id);
  }, [shops, shopAccountId]);

  useEffect(() => {
    setPageToken("");
    setPageTokenHistory([""]);
  }, [shopAccountId, dateSelection, orderStatusFilter]);

  const { start: dateStart, end: dateEnd } = useMemo(
    () => dateRangeFromSelection(dateSelection),
    [dateSelection],
  );

  const calendarYearPresetYears = useMemo(() => buildTikTokShopCalendarYearPresetYears(), []);

  const dashboardQueryEnabled =
    Boolean(organizationId && shopAccountId && reportingEnabled) && !gatePending;

  const {
    data: dashboard,
    isPending: dashboardPending,
    isFetching,
    error: dashboardError,
  } = useTikTokShopOrdersQuery({
    organizationId,
    shopAccountId,
    dateStart,
    dateEnd,
    pageToken,
    orderStatus: orderStatusFilter,
    enabled: dashboardQueryEnabled,
  });

  const {
    data: periodSummary,
    isPending: periodSummaryPending,
  } = useTikTokShopPeriodSummaryQuery({
    organizationId,
    shopAccountId,
    dateStart,
    dateEnd,
    orderStatus: orderStatusFilter,
    enabled: dashboardQueryEnabled,
  });

  const showSkeleton =
    gatePending ||
    reportingPending ||
    (reportingEnabled && settingsPending) ||
    (dashboardQueryEnabled && dashboardPending && !dashboard && !dashboardError);

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !shopAccountId) return;
    setRefreshing(true);
    try {
      const ordersRes = await fetchTikTokShopOrders({
        organizationId,
        shopAccountId,
        dateStart,
        dateEnd,
        pageToken,
        orderStatus: orderStatusFilter,
        forceRefresh: true,
      });
      if (ordersRes.rows?.length) {
        try {
          await pollTikTokOrdersForStock(
            organizationId,
            shopAccountId,
            ordersRes.rows.map((r) => r.order_id),
          );
        } catch {
          // stock ingest is best-effort on refresh
        }
      }
      await fetchTikTokShopPeriodSummary({
        organizationId,
        shopAccountId,
        dateStart,
        dateEnd,
        orderStatus: orderStatusFilter,
        forceRefresh: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-shop-orders", organizationId, shopAccountId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-shop-period-summary", organizationId, shopAccountId],
      });
      toast.success(
        t("digitalMarketing.tiktokShop.dashboard.refreshed", "Dashboard refreshed"),
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("digitalMarketing.tiktokShop.dashboard.refreshFailed", "Refresh failed"),
      );
    } finally {
      setRefreshing(false);
    }
  }, [organizationId, shopAccountId, dateStart, dateEnd, pageToken, orderStatusFilter, queryClient, t]);

  const goNextPage = () => {
    const next = dashboard?.next_page_token;
    if (!next) return;
    setPageTokenHistory((prev) => [...prev, next]);
    setPageToken(next);
  };

  const goPrevPage = () => {
    if (pageTokenHistory.length <= 1) return;
    const nextHistory = pageTokenHistory.slice(0, -1);
    setPageTokenHistory(nextHistory);
    setPageToken(nextHistory[nextHistory.length - 1] ?? "");
  };

  const errorMessage = dashboardError instanceof Error ? dashboardError.message : "";
  const errorCode =
    dashboardError && typeof dashboardError === "object" && "code" in dashboardError
      ? String((dashboardError as TikTokAdsEdgeError).code ?? "")
      : "";
  const isScopeError =
    errorCode === "TIKTOK_SHOP_SCOPE_ERROR" ||
    errorMessage.toLowerCase().includes("access denied") ||
    errorMessage.toLowerCase().includes("scope") ||
    errorMessage.toLowerCase().includes("permission");
  const displayErrorMessage = isScopeError
    ? t(
        "digitalMarketing.tiktokShop.dashboard.scopeErrorBody",
        "Order API scope is missing on this seller token. Enable Order information in Partner Center, then disconnect and re-authorize the seller in Settings.",
      )
    : errorMessage;

  if (showSkeleton) return <TikTokShopDashboardPageSkeleton />;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <TikTokShopHeaderAndTab />
            </div>

            {!reportingEnabled ? (
              <div className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <Alert>
                  <AlertTitle>
                    {t(
                      "digitalMarketing.tiktokShop.dashboard.notConnectedTitle",
                      "Connect TikTok Shop",
                    )}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {t(
                        "digitalMarketing.tiktokShop.dashboard.notConnectedBody",
                        "Connect a seller and sync shops in Settings to view order performance.",
                      )}
                    </p>
                    {canManage ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={TIKTOK_SHOP_SETTINGS_PATH}>
                          {t("digitalMarketing.tiktokShop.connectSeller", "Connect seller")}
                        </Link>
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              </div>
            ) : settings?.serverConfigured === false ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <Alert variant="destructive">
                  <AlertTitle>
                    {t("digitalMarketing.tiktokShop.serverNotConfigured", "Server not configured")}
                  </AlertTitle>
                  <AlertDescription>
                    {t(
                      "digitalMarketing.tiktokShop.serverNotConfiguredDesc",
                      "Set TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET, and TIKTOK_SHOP_SERVICE_ID in Supabase Edge Function secrets.",
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            ) : shops.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <Alert>
                  <AlertTitle>
                    {t("digitalMarketing.tiktokShop.dashboard.noShopsTitle", "No shops synced")}
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {t(
                        "digitalMarketing.tiktokShop.dashboard.noShopsBody",
                        "Sync authorized shops in Settings before viewing the dashboard.",
                      )}
                    </p>
                    {canManage ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={TIKTOK_SHOP_SETTINGS_PATH}>
                          {t("digitalMarketing.tiktokShop.tabSettings", "Settings")}
                        </Link>
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col xl:col-span-3">
                  <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <TikTokShopShopNav
                      shops={shops}
                      shopAccountId={shopAccountId}
                      onShopAccountIdChange={setShopAccountId}
                      shopsPending={settingsPending}
                    />
                  </div>
                </div>

                <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col gap-2 xl:col-span-9">
                  <TikTokShopDashboardSummaryBar
                    summary={periodSummary?.summary}
                    isLoading={periodSummaryPending && !periodSummary}
                  />

                  <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="space-y-3 border-b border-gray-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <TikTokAdsDateRangePicker
                            value={dateSelection}
                            onChange={setDateSelection}
                            calendarYearPresetYears={calendarYearPresetYears}
                            calendarYearFilterHint={t(
                              "digitalMarketing.tiktokShop.dashboard.dateLookbackHint",
                              "Up to 365 days",
                            )}
                          />
                          {dashboard?.shop_name ? (
                            <span className="text-xs text-muted-foreground">{dashboard.shop_name}</span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!dashboard?.rows?.length}
                            onClick={() => {
                              if (!dashboard?.rows?.length) return;
                              exportTikTokShopOrdersCsv({
                                rows: dashboard.rows,
                                shopName: dashboard.shop_name,
                                dateStart,
                                dateEnd,
                              });
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" aria-hidden />
                            {t("digitalMarketing.tiktokShop.dashboard.exportCsv", "Export CSV")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing || isFetching}
                          >
                            {refreshing || isFetching ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                            )}
                            {t("digitalMarketing.tiktokShop.dashboard.refresh", "Refresh")}
                          </Button>
                        </div>
                      </div>
                      <TikTokShopOrderStatusFilter
                        value={orderStatusFilter}
                        onChange={setOrderStatusFilter}
                      />
                    </div>

                    {dashboardError ? (
                      <div className="p-4">
                        <Alert variant="destructive">
                          <AlertTitle>
                            {t(
                              "digitalMarketing.tiktokShop.dashboard.loadErrorTitle",
                              "Could not load orders",
                            )}
                          </AlertTitle>
                          <AlertDescription className="space-y-2">
                            <p>{displayErrorMessage}</p>
                            {isScopeError && canManage ? (
                              <Button asChild variant="outline" size="sm">
                                <Link to={TIKTOK_SHOP_SETTINGS_PATH}>
                                  {t(
                                    "digitalMarketing.tiktokShop.dashboard.reauthorize",
                                    "Re-authorize in Settings",
                                  )}
                                </Link>
                              </Button>
                            ) : null}
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : (
                      <>
                        <TikTokShopOrdersTable
                          rows={dashboard?.rows ?? []}
                          currency={periodSummary?.summary?.currency ?? dashboard?.summary?.currency ?? "IDR"}
                          isLoading={dashboardPending && !dashboard}
                          onOrderSelect={(orderId) => {
                            setSelectedOrderId(orderId);
                            setDetailOpen(true);
                          }}
                        />
                        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={goPrevPage}
                            disabled={pageTokenHistory.length <= 1 || isFetching}
                          >
                            {t("digitalMarketing.tiktokShop.dashboard.prevPage", "Previous")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={goNextPage}
                            disabled={!dashboard?.next_page_token || isFetching}
                          >
                            {t("digitalMarketing.tiktokShop.dashboard.nextPage", "Next")}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <TikTokShopOrderDetailDrawer
              open={detailOpen}
              onOpenChange={setDetailOpen}
              organizationId={organizationId}
              shopAccountId={shopAccountId}
              orderId={selectedOrderId}
            />

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
