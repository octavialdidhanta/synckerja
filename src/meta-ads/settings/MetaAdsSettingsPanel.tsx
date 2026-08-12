import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/shared/lib/supabaseClient";
import { CONNECT_WHATSAPP_PATH } from "@/5-3-whatsapp/constants/omnichannelIntegrationPaths";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import type { MetaAdsOAuthReturnPath } from "@/meta-ads/settings/metaAdsSettingsPaths";

export type MetaAdsSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: MetaAdsOAuthReturnPath;
  className?: string;
  contentClassName?: string;
};

export function MetaAdsSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
  contentClassName,
}: MetaAdsSettingsPanelProps) {
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
    listAccessibleAdAccounts,
    listPixels,
    syncAccessibleAccounts,
  } = useMetaAdsSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountAdId, setAccountAdId] = useState("");
  const [accountPixelId, setAccountPixelId] = useState("");
  const [accountEventName, setAccountEventName] = useState("Purchase");
  const [accountIsDefault, setAccountIsDefault] = useState(false);
  const [pickerAccounts, setPickerAccounts] = useState<Array<{ account_id: string; name: string }>>([]);
  const [pickerPixels, setPickerPixels] = useState<Array<{ id: string; name: string }>>([]);

  const oauthConnected = data?.oauthConnected ?? false;
  const connection = data?.connection;
  const accounts = data?.accounts ?? [];

  const { data: whatsAppAccountCount = 0 } = useQuery({
    queryKey: ["meta-ads-settings-wa-accounts", organizationId],
    queryFn: async () => {
      if (!organizationId) return 0;
      const { count, error } = await supabase
        .from("organization_whatsapp_accounts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
  });

  const hasWhatsAppConnected = whatsAppAccountCount > 0;
  const hasConfiguredPixel = accounts.some(
    (a) => a.pixel_id && String(a.pixel_id).replace(/\D/g, "") !== "" && String(a.pixel_id) !== "0",
  );

  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      toast.success(t("omnichannel.settings.metaAds.connectedToast", "Meta Ads connected successfully."));
      searchParams.delete("connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      toast.error(t("omnichannel.settings.metaAds.oauthErrorToast", { message: oauthError, defaultValue: `Sign-in failed: ${oauthError}` }));
      searchParams.delete("oauth_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  const openAddAccount = () => {
    setEditAccountId(null);
    setAccountLabel("");
    setAccountAdId("");
    setAccountPixelId("");
    setAccountEventName("Purchase");
    setAccountIsDefault(accounts.length === 0);
    setPickerAccounts([]);
    setPickerPixels([]);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (id: string) => {
    const row = accounts.find((a) => a.id === id);
    if (!row) return;
    setEditAccountId(id);
    setAccountLabel(row.label);
    setAccountAdId(row.ad_account_id);
    setAccountPixelId(row.pixel_id);
    setAccountEventName(row.default_event_name || "Purchase");
    setAccountIsDefault(row.is_default);
    setPickerAccounts([]);
    setPickerPixels([]);
    setAccountDialogOpen(true);
  };

  useEffect(() => {
    if (!accountDialogOpen || !accountAdId || !organizationId) return;
    let cancelled = false;
    void (async () => {
      try {
        const pixels = await listPixels.mutateAsync(accountAdId);
        if (cancelled) return;
        setPickerPixels(pixels);
        setAccountPixelId((prev) => {
          if (prev && prev !== "0") return prev;
          if (pixels.length >= 1) return pixels[0].id;
          return prev;
        });
      } catch {
        if (!cancelled) setPickerPixels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // listPixels mutation identity is stable enough; ad id drives refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountDialogOpen, accountAdId, organizationId]);

  const handleLoadAccounts = async () => {
    try {
      const list = await listAccessibleAdAccounts.mutateAsync();
      setPickerAccounts(list.map((a) => ({ account_id: a.account_id, name: a.name || a.account_id })));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAccountPick = async (adAccountId: string) => {
    setAccountAdId(adAccountId);
    try {
      const pixels = await listPixels.mutateAsync(adAccountId);
      setPickerPixels(pixels);
      if (pixels.length === 1) setAccountPixelId(pixels[0].id);
    } catch {
      setPickerPixels([]);
    }
  };

  const handleSaveAccount = async () => {
    try {
      await upsertAccount.mutateAsync({
        id: editAccountId ?? undefined,
        label: accountLabel,
        ad_account_id: accountAdId,
        pixel_id: accountPixelId,
        default_event_name: accountEventName,
        is_default: accountIsDefault,
        is_active: true,
      });
      setAccountDialogOpen(false);
      toast.success(t("omnichannel.settings.metaAds.accountSaved", "Account saved"));
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
        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          <h3 className="font-semibold text-slate-900">
            {t("omnichannel.settings.metaAds.connectionTitle", "Meta Ads connection")}
          </h3>
          {oauthConnected ? (
            <>
              <p className="text-sm text-slate-600">
                {t("omnichannel.settings.metaAds.connectedHint", "Facebook account connected. Token stored encrypted on the server.")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("omnichannel.settings.metaAds.disconnectButton", "Disconnect")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {t("omnichannel.settings.metaAds.disconnectedHint", "Connect with Facebook to authorize Meta Ads reporting and conversions.")}
              </p>
              <Button
                type="button"
                onClick={() => startOAuth.mutate(oauthReturnPath)}
                disabled={startOAuth.isPending}
                className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
              >
                {startOAuth.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("omnichannel.settings.metaAds.connectButton", "Connect with Facebook")}
              </Button>
            </>
          )}

          {oauthConnected && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div>
                <Label htmlFor="meta-uploads-enabled">
                  {t("omnichannel.settings.metaAds.uploadsEnabled", "Enable offline conversion uploads")}
                </Label>
                <p className="text-xs text-slate-500">
                  {t("omnichannel.settings.metaAds.uploadsEnabledHint", "When off, converted leads are not sent to Meta.")}
                </p>
              </div>
              <Switch
                id="meta-uploads-enabled"
                checked={connection?.is_active ?? false}
                onCheckedChange={(v) => updateConnection.mutate({ is_active: v })}
              />
            </div>
          )}

          {oauthConnected && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {t("omnichannel.settings.metaAds.ctwaTitle", "Click-to-WhatsApp conversions")}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  {t(
                    "omnichannel.settings.metaAds.ctwaHint",
                    "When a customer opens WhatsApp from a Meta ad, Synckerja captures the click ID from the first message. On Converted, we send it to Meta using the same offline upload toggle above.",
                  )}
                </p>
              </div>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center gap-2 text-slate-700">
                  {hasWhatsAppConnected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  {hasWhatsAppConnected
                    ? t("omnichannel.settings.metaAds.ctwaWhatsAppOk", "WhatsApp Business connected")
                    : t(
                        "omnichannel.settings.metaAds.ctwaWhatsAppMissing",
                        "Connect WhatsApp Business to receive CTWA messages",
                      )}
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  {hasConfiguredPixel ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  {hasConfiguredPixel
                    ? t("omnichannel.settings.metaAds.ctwaPixelOk", "Meta Pixel configured on an ad account")
                    : t(
                        "omnichannel.settings.metaAds.ctwaPixelMissing",
                        "Add an ad account with a valid Pixel ID below",
                      )}
                </li>
              </ul>
              {!hasWhatsAppConnected && (
                <Link
                  to={CONNECT_WHATSAPP_PATH}
                  className="inline-flex text-xs font-medium text-[#1877F2] hover:underline"
                >
                  {t("omnichannel.settings.metaAds.ctwaOpenWhatsAppSettings", "Open Connect WhatsApp")}
                </Link>
              )}
            </div>
          )}

          {oauthConnected && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testConnection.mutate(undefined)}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("omnichannel.settings.metaAds.testButton", "Test connection")}
              </Button>
              <span className="text-xs text-slate-500">
                {connection?.last_test_ok === true
                  ? t("omnichannel.settings.metaAds.lastTestOk", "Last test: OK")
                  : connection?.last_test_error
                    ? connection.last_test_error
                    : t("omnichannel.settings.metaAds.neverTested", "Not tested yet")}
              </span>
            </div>
          )}
        </div>

        {oauthConnected && (
          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">
                {t("omnichannel.settings.metaAds.accountsTitle", "Meta Ads accounts")}
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await syncAccessibleAccounts.mutateAsync();
                      const resolved =
                        (result as { pixelsResolved?: number })?.pixelsResolved ?? 0;
                      if (resolved > 0) {
                        toast.success(
                          t("omnichannel.settings.metaAds.pixelsAutoFilled", {
                            count: resolved,
                            defaultValue: `Filled Pixel ID for ${resolved} account(s) from Meta.`,
                          }),
                        );
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  disabled={syncAccessibleAccounts.isPending}
                >
                  {syncAccessibleAccounts.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {t("omnichannel.settings.metaAds.syncFromMeta", "Sync from Meta")}
                </Button>
                <Button type="button" size="sm" onClick={openAddAccount}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("omnichannel.settings.metaAds.addAccount", "Add account")}
                </Button>
              </div>
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("omnichannel.settings.metaAds.noAccounts", "No ad accounts configured. Sync from Meta or add manually.")}
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
                        {acc.is_default ? ` (${t("omnichannel.settings.metaAds.default", "default")})` : ""}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        act_{acc.ad_account_id} · Pixel {acc.pixel_id} · {acc.default_event_name}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!acc.is_default && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDefaultAccount.mutate(acc.id)}>
                          {t("omnichannel.settings.metaAds.setDefault", "Set default")}
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEditAccount(acc.id)}>
                        {t("omnichannel.settings.metaAds.edit", "Edit")}
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
                ? t("omnichannel.settings.metaAds.editAccount", "Edit account")
                : t("omnichannel.settings.metaAds.addAccount", "Add account")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button type="button" variant="outline" size="sm" onClick={handleLoadAccounts}>
              {t("omnichannel.settings.metaAds.loadAdAccounts", "Load ad accounts from Meta")}
            </Button>
            {pickerAccounts.length > 0 && (
              <Select onValueChange={handleAccountPick}>
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.settings.metaAds.pickAdAccount", "Pick ad account")} />
                </SelectTrigger>
                <SelectContent>
                  {pickerAccounts.map((a) => (
                    <SelectItem key={a.account_id} value={a.account_id}>
                      {a.name} ({a.account_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div>
              <Label>{t("omnichannel.settings.metaAds.adAccountId", "Ad account ID")}</Label>
              <Input value={accountAdId} onChange={(e) => setAccountAdId(e.target.value.replace(/\D/g, ""))} />
            </div>
            {pickerPixels.length > 0 && (
              <Select value={accountPixelId} onValueChange={setAccountPixelId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.settings.metaAds.pickPixel", "Pick pixel")} />
                </SelectTrigger>
                <SelectContent>
                  {pickerPixels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div>
              <Label>{t("omnichannel.settings.metaAds.pixelId", "Pixel ID")}</Label>
              <Input value={accountPixelId} onChange={(e) => setAccountPixelId(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <Label>{t("omnichannel.settings.metaAds.eventName", "CAPI event name")}</Label>
              <Input value={accountEventName} onChange={(e) => setAccountEventName(e.target.value)} />
            </div>
            <div>
              <Label>{t("omnichannel.settings.metaAds.label", "Label")}</Label>
              <Input value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={accountIsDefault} onCheckedChange={setAccountIsDefault} id="meta-default-acc" />
              <Label htmlFor="meta-default-acc">{t("omnichannel.settings.metaAds.defaultAccount", "Default account")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSaveAccount}>
              {t("omnichannel.settings.metaAds.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
