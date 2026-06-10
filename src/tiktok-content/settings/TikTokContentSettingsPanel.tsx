import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import type { TikTokContentOAuthReturnPath } from "@/tiktok-content/settings/tiktokContentSettingsPaths";

export type TikTokContentSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: TikTokContentOAuthReturnPath;
  className?: string;
};

export function TikTokContentSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
}: TikTokContentSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data,
    isPending,
    startOAuth,
    disconnect,
    setDefaultAccount,
    deleteAccount,
  } = useTikTokContentSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const oauthConnected = data?.oauthConnected ?? false;
  const serverConfigured = data?.serverConfigured !== false;
  const accounts = data?.accounts ?? [];

  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      toast.success(
        t("digitalMarketing.tiktokContent.connectedToast", "TikTok account connected successfully."),
      );
      searchParams.delete("connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      const displayMessage =
        oauthError === "OK"
          ? t(
              "digitalMarketing.tiktokContent.oauthErrorGeneric",
              "Sign-in failed while saving TikTok tokens. Please try Connect again.",
            )
          : oauthError;
      toast.error(
        t("digitalMarketing.tiktokContent.oauthErrorToast", {
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {t("digitalMarketing.tiktokContent.settingsTitle", "TikTok Content")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "digitalMarketing.tiktokContent.settingsDesc",
            "Connect TikTok creator accounts via Login Kit to pull organic video insights.",
          )}
        </p>
      </div>

      {!serverConfigured && (
        <Alert variant="destructive">
          <AlertTitle>{t("digitalMarketing.tiktokContent.serverNotConfigured", "Server not configured")}</AlertTitle>
          <AlertDescription>
            {t(
              "digitalMarketing.tiktokContent.serverNotConfiguredDesc",
              "Set TIKTOK_CONTENT_CLIENT_KEY and TIKTOK_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!serverConfigured || startOAuth.isPending}
          onClick={() => startOAuth.mutate(oauthReturnPath)}
        >
          {startOAuth.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("digitalMarketing.tiktokContent.connectAccount", "Connect TikTok account")}
        </Button>
        {oauthConnected && (
          <Button
            type="button"
            variant="outline"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate(undefined)}
          >
            {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("digitalMarketing.tiktokContent.disconnectAll", "Disconnect all")}
          </Button>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("digitalMarketing.tiktokContent.connectedAccounts", "Connected accounts")}
          </p>
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{acc.label || acc.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">{acc.open_id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!acc.is_default && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDefaultAccount.mutate(acc.id)}
                  >
                    {t("digitalMarketing.tiktokContent.setDefault", "Set default")}
                  </Button>
                )}
                {acc.is_default && (
                  <span className="text-xs text-primary">{t("digitalMarketing.tiktokContent.default", "Default")}</span>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("digitalMarketing.tiktokContent.removeAccount", "Remove account")}
                  onClick={() => deleteAccount.mutate(acc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
