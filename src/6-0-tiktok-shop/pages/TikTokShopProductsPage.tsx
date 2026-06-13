import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TikTokShopHeaderAndTab } from "@/6-0-tiktok-shop/container/TikTokShopHeaderAndTab";
import { TikTokShopShopNav } from "@/6-0-tiktok-shop/container/TikTokShopShopNav";
import { TikTokShopProductStatusFilter } from "@/6-0-tiktok-shop/container/TikTokShopProductStatusFilter";
import { TikTokShopProductsTable } from "@/6-0-tiktok-shop/container/TikTokShopProductsTable";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useTikTokShopReportingEnabled } from "@/tiktok-shop/hooks/useTikTokShopReportingEnabled";
import { useTikTokShopSettings } from "@/tiktok-shop/hooks/useTikTokShopSettings";
import {
  fetchTikTokShopProducts,
  useTikTokShopProductsQuery,
} from "@/tiktok-shop/hooks/useTikTokShopProductsQuery";
import {
  STOCK_MANAGEMENT_MAPPING_PATH,
} from "@/stock-management/lib/inventoryPaths";
import {
  TIKTOK_SHOP_PAGE_PATH,
  TIKTOK_SHOP_SETTINGS_PATH,
} from "@/tiktok-shop/settings/tiktokShopSettingsPaths";
import { TikTokShopProductsPageSkeleton } from "@/6-0-tiktok-shop/skeletons/TikTokShopProductsPageSkeleton";
import type { TikTokAdsEdgeError } from "@/tiktok-ads/lib/parseEdgeFunctionError";

const PAGE_PATH = TIKTOK_SHOP_PAGE_PATH;

export default function TikTokShopProductsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <TikTokShopProductsPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={PAGE_PATH}>
      <TikTokShopProductsPageContent />
    </ModuleShellContentGate>
  );
}

function TikTokShopProductsPageContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: reportingEnabled = false, isPending: reportingPending } =
    useTikTokShopReportingEnabled(organizationId);
  const { data: settings, isPending: settingsPending } = useTikTokShopSettings(organizationId, {
    enabled: Boolean(organizationId) && !gatePending,
  });

  const [shopAccountId, setShopAccountId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [pageTokenHistory, setPageTokenHistory] = useState<string[]>([""]);
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
  }, [shopAccountId, statusFilter]);

  const queryEnabled =
    Boolean(organizationId && shopAccountId && reportingEnabled) && !gatePending;

  const {
    data: products,
    isPending: productsPending,
    isFetching,
    error: productsError,
  } = useTikTokShopProductsQuery({
    organizationId,
    shopAccountId,
    pageToken,
    status: statusFilter,
    enabled: queryEnabled,
  });

  const showSkeleton =
    gatePending ||
    reportingPending ||
    (reportingEnabled && settingsPending) ||
    (queryEnabled && productsPending && !products && !productsError);

  const handleRefresh = useCallback(async () => {
    if (!organizationId || !shopAccountId) return;
    setRefreshing(true);
    try {
      await fetchTikTokShopProducts({
        organizationId,
        shopAccountId,
        pageToken,
        status: statusFilter,
        forceRefresh: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ["tiktok-shop-products", organizationId, shopAccountId],
      });
      toast.success(
        t("digitalMarketing.tiktokShop.products.refreshed", "Products refreshed"),
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("digitalMarketing.tiktokShop.products.refreshFailed", "Refresh failed"),
      );
    } finally {
      setRefreshing(false);
    }
  }, [organizationId, shopAccountId, pageToken, statusFilter, queryClient, t]);

  const errorMessage = productsError instanceof Error ? productsError.message : "";
  const errorCode =
    productsError && typeof productsError === "object" && "code" in productsError
      ? String((productsError as TikTokAdsEdgeError).code ?? "")
      : "";
  const isScopeError = errorCode === "TIKTOK_SHOP_PRODUCT_SCOPE_ERROR";
  const displayErrorMessage = isScopeError
    ? t(
        "digitalMarketing.tiktokShop.products.scopeErrorBody",
        "Product API scope is missing on this seller token. Enable Product basic in Partner Center, then disconnect and re-authorize the seller in Settings.",
      )
    : errorMessage;

  if (showSkeleton) return <TikTokShopProductsPageSkeleton />;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <TikTokShopHeaderAndTab />
            </div>

            {!reportingEnabled ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
                        "digitalMarketing.tiktokShop.products.notConnectedBody",
                        "Connect a seller and sync shops in Settings to view products.",
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
                        "Sync authorized shops in Settings before viewing products.",
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
                  <Alert className="border-blue-200 bg-blue-50/80">
                    <AlertTitle>
                      {t(
                        "digitalMarketing.tiktokShop.products.stockManagedBadge",
                        "Stock from Stock Management",
                      )}
                    </AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-2">
                      <span>
                        {t(
                          "operations.stockManagement.sharedPoolHint",
                          "Shared pool — same qty on all mapped platforms",
                        )}
                      </span>
                      <Button asChild size="sm" variant="link" className="h-auto p-0">
                        <Link to={STOCK_MANAGEMENT_MAPPING_PATH}>
                          {t(
                            "digitalMarketing.tiktokShop.products.stockManagedLink",
                            "Manage mapping",
                          )}
                        </Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                  <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
                      <div className="space-y-2">
                        <TikTokShopProductStatusFilter
                          value={statusFilter}
                          onChange={setStatusFilter}
                        />
                        {products?.shop_name ? (
                          <p className="text-xs text-muted-foreground">
                            {products.shop_name}
                            {products.summary?.total_count != null
                              ? ` · ${t(
                                  "digitalMarketing.tiktokShop.products.totalLabel",
                                  "{{count}} products",
                                  { count: products.summary.total_count },
                                )}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
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
                        {t("digitalMarketing.tiktokShop.products.refresh", "Refresh")}
                      </Button>
                    </div>

                    {productsError ? (
                      <div className="p-4">
                        <Alert variant="destructive">
                          <AlertTitle>
                            {t(
                              "digitalMarketing.tiktokShop.products.loadErrorTitle",
                              "Could not load products",
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
                        <TikTokShopProductsTable
                          rows={products?.rows ?? []}
                          isLoading={productsPending && !products}
                        />
                        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (pageTokenHistory.length <= 1) return;
                              const nextHistory = pageTokenHistory.slice(0, -1);
                              setPageTokenHistory(nextHistory);
                              setPageToken(nextHistory[nextHistory.length - 1] ?? "");
                            }}
                            disabled={pageTokenHistory.length <= 1 || isFetching}
                          >
                            {t("digitalMarketing.tiktokShop.dashboard.prevPage", "Previous")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const next = products?.next_page_token;
                              if (!next) return;
                              setPageTokenHistory((prev) => [...prev, next]);
                              setPageToken(next);
                            }}
                            disabled={!products?.next_page_token || isFetching}
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
