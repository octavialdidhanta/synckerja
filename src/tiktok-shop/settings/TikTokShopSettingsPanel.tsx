import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import { useTikTokShopSettings } from "@/tiktok-shop/hooks/useTikTokShopSettings";
import type { TikTokShopOAuthReturnPath } from "@/tiktok-shop/settings/tiktokShopSettingsPaths";

export type TikTokShopSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: TikTokShopOAuthReturnPath;
  className?: string;
};

function sellerDisplayLabel(
  sellerOpenId: string,
  sellerName: string | null | undefined,
): string {
  const name = sellerName?.trim();
  if (name) return name;
  if (sellerOpenId.startsWith("fallback_")) return sellerOpenId.replace(/^fallback_/, "");
  return sellerOpenId.length > 12 ? `${sellerOpenId.slice(0, 8)}…` : sellerOpenId;
}

export function TikTokShopSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
}: TikTokShopSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data,
    isPending,
    startOAuth,
    disconnect,
    setDefaultShop,
    deleteShop,
    syncAuthorizedShops,
    testConnection,
  } = useTikTokShopSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const oauthConnected = data?.oauthConnected ?? false;
  const serverConfigured = data?.serverConfigured !== false;
  const sellers = data?.sellers ?? [];
  const connection = data?.connection;

  useEffect(() => {
    const connected = searchParams.get("connected");
    const existing = searchParams.get("existing");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      if (existing === "1") {
        toast.info(
          t(
            "digitalMarketing.tiktokShop.reconnectedToast",
            "This TikTok Shop seller is already connected. Authorize a different seller account to add another.",
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.tiktokShop.connectedToast", "TikTok Shop seller connected successfully."),
        );
      }
      searchParams.delete("connected");
      searchParams.delete("existing");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      const displayMessage =
        oauthError === "OK"
          ? t(
              "digitalMarketing.tiktokShop.oauthErrorGeneric",
              "Sign-in failed while saving TikTok Shop tokens. Please try Connect again.",
            )
          : oauthError;
      toast.error(
        t("digitalMarketing.tiktokShop.oauthErrorToast", {
          message: displayMessage,
          defaultValue: `Sign-in failed: ${displayMessage}`,
        }),
      );
      searchParams.delete("oauth_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  if (isPending) {
    return (
      <div className={cn("space-y-3 p-4", className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {!serverConfigured && (
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
      )}

      {oauthConnected && connection?.last_test_at && (
        <Alert variant={connection.last_test_ok ? "default" : "destructive"}>
          <AlertTitle>
            {connection.last_test_ok
              ? t("digitalMarketing.tiktokShop.testOk", "Connection test passed")
              : t("digitalMarketing.tiktokShop.testFailed", "Connection test failed")}
          </AlertTitle>
          {connection.last_test_error && !connection.last_test_ok && (
            <AlertDescription>{connection.last_test_error}</AlertDescription>
          )}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!serverConfigured || startOAuth.isPending}
          onClick={() => startOAuth.mutate(oauthReturnPath)}
        >
          {startOAuth.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {sellers.length > 0
            ? t("digitalMarketing.tiktokShop.connectAnotherSeller", "Connect another seller")
            : t("digitalMarketing.tiktokShop.connectSeller", "Connect seller")}
        </Button>
        {oauthConnected && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={testConnection.isPending}
              onClick={() => testConnection.mutate(undefined)}
            >
              {testConnection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("digitalMarketing.tiktokShop.testConnection", "Test connection")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined)}
            >
              {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("digitalMarketing.tiktokShop.disconnectAll", "Disconnect all")}
            </Button>
          </>
        )}
      </div>

      {sellers.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("digitalMarketing.tiktokShop.connectedSellers", "Connected sellers")}
          </p>
          {sellers.map((seller) => {
            const sellerLabel = sellerDisplayLabel(seller.seller_open_id, seller.seller_name);
            return (
              <div
                key={seller.seller_open_id}
                className="rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{sellerLabel}</p>
                    {seller.seller_base_region && (
                      <p className="text-xs text-muted-foreground">{seller.seller_base_region}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={syncAuthorizedShops.isPending}
                      onClick={() => syncAuthorizedShops.mutate(seller.seller_open_id)}
                    >
                      {syncAuthorizedShops.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">
                        {t("digitalMarketing.tiktokShop.syncShops", "Sync shops")}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disconnect.isPending}
                      onClick={() => disconnect.mutate(seller.seller_open_id)}
                    >
                      {t("digitalMarketing.tiktokShop.disconnectSeller", "Disconnect")}
                    </Button>
                  </div>
                </div>
                {seller.shops.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {seller.shops.map((shop) => (
                      <div
                        key={shop.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {shop.label || shop.shop_name || shop.shop_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shop.region ? `${shop.region} · ` : ""}
                            {shop.shop_id}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!shop.is_default && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDefaultShop.mutate(shop.id)}
                            >
                              {t("digitalMarketing.tiktokShop.setDefault", "Set default")}
                            </Button>
                          )}
                          {shop.is_default && (
                            <span className="text-xs text-primary">
                              {t("digitalMarketing.tiktokShop.default", "Default")}
                            </span>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("digitalMarketing.tiktokShop.removeShop", "Remove shop")}
                            onClick={() => deleteShop.mutate(shop.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    {t("digitalMarketing.tiktokShop.noShops", "No shops synced yet. Try Sync shops.")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
