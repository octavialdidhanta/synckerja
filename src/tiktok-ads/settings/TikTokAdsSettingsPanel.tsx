import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import { useTikTokAdsSettings } from "@/tiktok-ads/hooks/useTikTokAdsSettings";
import type { TikTokAdsOAuthReturnPath } from "@/tiktok-ads/settings/tiktokAdsSettingsPaths";

export type TikTokAdsSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: TikTokAdsOAuthReturnPath;
  className?: string;
  contentClassName?: string;
};

export function TikTokAdsSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
  contentClassName,
}: TikTokAdsSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data,
    isPending,
    startOAuth,
    disconnect,
    updateConnection,
    upsertAccount,
    deleteAccount,
    setDefaultAccount,
    testConnection,
    listAccessibleAdvertisers,
    syncAccessibleAccounts,
  } = useTikTokAdsSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountAdvertiserId, setAccountAdvertiserId] = useState("");
  const [accountIsDefault, setAccountIsDefault] = useState(false);
  const [pickerAdvertisers, setPickerAdvertisers] = useState<
    Array<{ advertiser_id: string; name: string }>
  >([]);

  const oauthConnected = data?.oauthConnected ?? false;
  const serverConfigured = data?.serverConfigured !== false;
  const connection = data?.connection;
  const accounts = data?.accounts ?? [];

  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      toast.success(
        t("digitalMarketing.tiktokAds.connectedToast", "TikTok Ads connected successfully."),
      );
      searchParams.delete("connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      const displayMessage =
        oauthError === "OK"
          ? t(
              "digitalMarketing.tiktokAds.oauthErrorGeneric",
              "Sign-in failed while saving TikTok tokens. Please try Connect again.",
            )
          : oauthError;
      toast.error(
        t("digitalMarketing.tiktokAds.oauthErrorToast", {
          message: displayMessage,
          defaultValue: `Sign-in failed: ${displayMessage}`,
        }),
      );
      searchParams.delete("oauth_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  const openAddAccount = () => {
    setEditAccountId(null);
    setAccountLabel("");
    setAccountAdvertiserId("");
    setAccountIsDefault(accounts.length === 0);
    setPickerAdvertisers([]);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (id: string) => {
    const row = accounts.find((a) => a.id === id);
    if (!row) return;
    setEditAccountId(id);
    setAccountLabel(row.label);
    setAccountAdvertiserId(row.advertiser_id);
    setAccountIsDefault(row.is_default);
    setPickerAdvertisers([]);
    setAccountDialogOpen(true);
  };

  const handleLoadAdvertisers = async () => {
    try {
      const list = await listAccessibleAdvertisers.mutateAsync();
      setPickerAdvertisers(
        list.map((a) => ({ advertiser_id: a.advertiser_id, name: a.name || a.advertiser_id })),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAdvertiserPick = (advertiserId: string) => {
    setAccountAdvertiserId(advertiserId);
    const picked = pickerAdvertisers.find((a) => a.advertiser_id === advertiserId);
    if (picked && !accountLabel.trim()) {
      setAccountLabel(picked.name);
    }
  };

  const handleSaveAccount = async () => {
    try {
      await upsertAccount.mutateAsync({
        id: editAccountId ?? undefined,
        label: accountLabel,
        advertiser_id: accountAdvertiserId,
        is_default: accountIsDefault,
        is_active: true,
      });
      setAccountDialogOpen(false);
      toast.success(t("digitalMarketing.tiktokAds.accountSaved", "Account saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isPending) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className={cn("space-y-4", contentClassName)}>
        {!serverConfigured ? (
          <Alert variant="destructive">
            <AlertTitle>
              {t(
                "digitalMarketing.tiktokAds.serverNotConfiguredTitle",
                "TikTok Ads server not configured",
              )}
            </AlertTitle>
            <AlertDescription>
              {t(
                "digitalMarketing.tiktokAds.serverNotConfiguredBody",
                "An admin must set TIKTOK_ADS_CLIENT_KEY and TIKTOK_ADS_CLIENT_SECRET in Supabase Edge Function secrets before OAuth and reporting can work.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold text-slate-900">
            {t("digitalMarketing.tiktokAds.connectionTitle", "TikTok Ads connection")}
          </h3>
          {oauthConnected ? (
            <>
              <p className="text-sm text-slate-600">
                {t(
                  "digitalMarketing.tiktokAds.connectedHint",
                  "TikTok account connected. Token stored encrypted on the server.",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("digitalMarketing.tiktokAds.disconnectButton", "Disconnect")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {t(
                  "digitalMarketing.tiktokAds.disconnectedHint",
                  "Connect with TikTok to authorize TikTok Ads reporting.",
                )}
              </p>
              <Button
                type="button"
                onClick={() => startOAuth.mutate(oauthReturnPath)}
                disabled={startOAuth.isPending || !serverConfigured}
                className="bg-black hover:bg-gray-900 text-white"
              >
                {startOAuth.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("digitalMarketing.tiktokAds.connectButton", "Connect with TikTok")}
              </Button>
            </>
          )}

          {oauthConnected && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div>
                <Label htmlFor="tiktok-uploads-enabled">
                  {t("digitalMarketing.tiktokAds.uploadsEnabled", "Enable conversion uploads")}
                </Label>
                <p className="text-xs text-slate-500">
                  {t(
                    "digitalMarketing.tiktokAds.uploadsEnabledHint",
                    "When off, converted leads are not sent to TikTok.",
                  )}
                </p>
              </div>
              <Switch
                id="tiktok-uploads-enabled"
                checked={connection?.is_active ?? false}
                onCheckedChange={(v) => updateConnection.mutate({ is_active: v })}
              />
            </div>
          )}

          {oauthConnected && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending || !serverConfigured}
              >
                {testConnection.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("digitalMarketing.tiktokAds.testButton", "Test connection")}
              </Button>
              <span className="text-xs text-slate-500">
                {connection?.last_test_ok === true
                  ? t("digitalMarketing.tiktokAds.lastTestOk", "Last test: OK")
                  : connection?.last_test_error
                    ? connection.last_test_error
                    : t("digitalMarketing.tiktokAds.neverTested", "Not tested yet")}
              </span>
            </div>
          )}
        </div>

        {oauthConnected && (
          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">
                {t("digitalMarketing.tiktokAds.accountsTitle", "TikTok Ads advertisers")}
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await syncAccessibleAccounts.mutateAsync();
                      const imported = (result as { imported?: number })?.imported ?? 0;
                      if (imported > 0) {
                        toast.success(
                          t("digitalMarketing.tiktokAds.syncImported", {
                            count: imported,
                            defaultValue: `Imported ${imported} advertiser(s) from TikTok.`,
                          }),
                        );
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  disabled={syncAccessibleAccounts.isPending || !serverConfigured}
                >
                  {syncAccessibleAccounts.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {t("digitalMarketing.tiktokAds.syncFromTikTok", "Sync from TikTok")}
                </Button>
                <Button type="button" size="sm" onClick={openAddAccount}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("digitalMarketing.tiktokAds.addAccount", "Add advertiser")}
                </Button>
              </div>
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t(
                  "digitalMarketing.tiktokAds.noAccounts",
                  "No advertisers configured. Sync from TikTok or add manually.",
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {accounts.map((acc) => (
                  <li
                    key={acc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {acc.label}
                        {acc.is_default
                          ? ` (${t("digitalMarketing.tiktokAds.default", "default")})`
                          : ""}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{acc.advertiser_id}</p>
                    </div>
                    <div className="flex gap-1">
                      {!acc.is_default && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultAccount.mutate(acc.id)}
                        >
                          {t("digitalMarketing.tiktokAds.setDefault", "Set default")}
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEditAccount(acc.id)}>
                        {t("digitalMarketing.tiktokAds.edit", "Edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => deleteAccount.mutate(acc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editAccountId
                ? t("digitalMarketing.tiktokAds.editAccount", "Edit advertiser")
                : t("digitalMarketing.tiktokAds.addAccount", "Add advertiser")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadAdvertisers}
              disabled={!serverConfigured || listAccessibleAdvertisers.isPending}
            >
              {t("digitalMarketing.tiktokAds.loadAdvertisers", "Load advertisers from TikTok")}
            </Button>
            {pickerAdvertisers.length > 0 && (
              <Select onValueChange={handleAdvertiserPick}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("digitalMarketing.tiktokAds.pickAdvertiser", "Pick advertiser")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {pickerAdvertisers.map((a) => (
                    <SelectItem key={a.advertiser_id} value={a.advertiser_id}>
                      {a.name} ({a.advertiser_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div>
              <Label>{t("digitalMarketing.tiktokAds.advertiserId", "Advertiser ID")}</Label>
              <Input
                value={accountAdvertiserId}
                onChange={(e) => setAccountAdvertiserId(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <Label>{t("digitalMarketing.tiktokAds.label", "Label")}</Label>
              <Input value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={accountIsDefault} onCheckedChange={setAccountIsDefault} id="tiktok-default-acc" />
              <Label htmlFor="tiktok-default-acc">
                {t("digitalMarketing.tiktokAds.defaultAccount", "Default advertiser")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSaveAccount}>
              {t("digitalMarketing.tiktokAds.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
