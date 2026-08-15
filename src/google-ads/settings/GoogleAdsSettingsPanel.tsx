import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router-dom";
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
import { cn } from "@/shared/lib/utils";
import {
  clearOfflineConversionOAuthStart,
  shouldConsumeOfflineConversionOAuthResult,
} from "@/5-3-dashboard/omnichannel-settings/lib/offlineConversionOAuthResult";
import { useGoogleAdsSettings } from "@/google-ads/hooks/useGoogleAdsSettings";
import type { GoogleAdsOAuthReturnPath } from "@/google-ads/settings/googleAdsSettingsPaths";
import { retryGoogleAdsUploadsForConvertedLeads } from "@/shared/lib/retryGoogleAdsUploadsForConvertedLeads";

const LEGACY_SEED_ORG_ID = "663c9336-8cb6-4a36-9ad9-313126e70a1a";

export type GoogleAdsSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: GoogleAdsOAuthReturnPath;
  className?: string;
  contentClassName?: string;
};

export function GoogleAdsSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
  contentClassName,
}: GoogleAdsSettingsPanelProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
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
    listAccessibleCustomers,
    listConversionActions,
    importLegacy,
    syncAccessibleAccounts,
  } = useGoogleAdsSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const [mccDraft, setMccDraft] = useState("");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountCustomerId, setAccountCustomerId] = useState("");
  const [accountConversionId, setAccountConversionId] = useState("");
  const [accountIsDefault, setAccountIsDefault] = useState(false);
  const [pickerCustomers, setPickerCustomers] = useState<string[]>([]);

  const oauthConnected = data?.oauthConnected ?? false;
  const connection = data?.connection;
  const accounts = data?.accounts ?? [];

  useEffect(() => {
    if (connection?.login_customer_id != null) {
      setMccDraft(connection.login_customer_id);
    }
  }, [connection?.login_customer_id]);

  useEffect(() => {
    if (!shouldConsumeOfflineConversionOAuthResult(searchParams, "google", pathname)) return;

    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected === "1") {
      toast.success(t("omnichannel.settings.googleAds.connectedToast"));
    }
    if (oauthError) {
      toast.error(t("omnichannel.settings.googleAds.oauthErrorToast", { message: oauthError }));
    }

    const next = new URLSearchParams(searchParams);
    next.delete("connected");
    next.delete("oauth_error");
    next.delete("platform");
    clearOfflineConversionOAuthStart();
    setSearchParams(next, { replace: true });
  }, [pathname, searchParams, setSearchParams, t]);

  const openAddAccount = () => {
    setEditAccountId(null);
    setAccountLabel("");
    setAccountCustomerId("");
    setAccountConversionId("");
    setAccountIsDefault(accounts.length === 0);
    setPickerCustomers([]);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (id: string) => {
    const row = accounts.find((a) => a.id === id);
    if (!row) return;
    setEditAccountId(id);
    setAccountLabel(row.label);
    setAccountCustomerId(row.customer_id);
    setAccountConversionId(row.conversion_action_id);
    setAccountIsDefault(row.is_default);
    setPickerCustomers([]);
    setAccountDialogOpen(true);
  };

  const handleLoadCustomers = async () => {
    try {
      const ids = await listAccessibleCustomers.mutateAsync();
      setPickerCustomers(ids);
      if (ids.length === 0) {
        toast.message(t("omnichannel.settings.googleAds.noAccessibleCustomers"));
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCustomerPick = async (customerId: string) => {
    setAccountCustomerId(customerId);
    try {
      const actions = await listConversionActions.mutateAsync(customerId);
      if (actions.length === 1) {
        setAccountConversionId(actions[0].id);
      }
    } catch {
      // User can still type conversion action id manually
    }
  };

  const handleSaveAccount = async () => {
    try {
      await upsertAccount.mutateAsync({
        id: editAccountId ?? undefined,
        label: accountLabel,
        customer_id: accountCustomerId,
        conversion_action_id: accountConversionId,
        is_default: accountIsDefault,
      });
      toast.success(t("omnichannel.settings.googleAds.accountSaved"));
      setAccountDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const lastTestLabel = useMemo(() => {
    if (!connection?.last_test_at) return t("omnichannel.settings.googleAds.neverTested");
    if (connection.last_test_ok) return t("omnichannel.settings.googleAds.lastTestOk");
    return connection.last_test_error ?? t("omnichannel.settings.googleAds.lastTestFailed");
  }, [connection, t]);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          contentClassName,
        )}
      >
        {isPending ? (
          <Skeleton className="h-40 w-full max-w-2xl" />
        ) : (
          <div className="max-w-2xl space-y-6">
            <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold">{t("omnichannel.settings.googleAds.connectionTitle")}</h3>
              <p className="text-xs text-muted-foreground">
                {oauthConnected
                  ? t("omnichannel.settings.googleAds.connectedHint")
                  : t("omnichannel.settings.googleAds.disconnectedHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {!oauthConnected ? (
                  <>
                    <Button
                      type="button"
                      disabled={startOAuth.isPending}
                      onClick={() => startOAuth.mutate(oauthReturnPath)}
                    >
                      {startOAuth.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {t("omnichannel.settings.googleAds.connectButton")}
                    </Button>
                    {organizationId === LEGACY_SEED_ORG_ID ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={importLegacy.isPending}
                        onClick={async () => {
                          try {
                            await importLegacy.mutateAsync();
                            toast.success(t("omnichannel.settings.googleAds.legacyImportOk"));
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        {t("omnichannel.settings.googleAds.legacyImportButton")}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disconnect.isPending}
                    onClick={async () => {
                      try {
                        await disconnect.mutateAsync();
                        toast.success(t("omnichannel.settings.googleAds.disconnectedToast"));
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {t("omnichannel.settings.googleAds.disconnectButton")}
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="google-ads-mcc">{t("omnichannel.settings.googleAds.mccLabel")}</Label>
                <Input
                  id="google-ads-mcc"
                  value={mccDraft}
                  onChange={(e) => setMccDraft(e.target.value.replace(/\D/g, ""))}
                  placeholder="1234567890"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">{t("omnichannel.settings.googleAds.mccHint")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!oauthConnected || updateConnection.isPending}
                  onClick={async () => {
                    try {
                      await updateConnection.mutateAsync({
                        login_customer_id: mccDraft || null,
                      });
                      toast.success(t("omnichannel.settings.googleAds.mccSaved"));
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {t("omnichannel.settings.googleAds.saveMcc")}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium">{t("omnichannel.settings.googleAds.uploadsEnabled")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("omnichannel.settings.googleAds.uploadsEnabledHint")}
                  </p>
                </div>
                <Switch
                  checked={connection?.is_active ?? false}
                  disabled={!oauthConnected || updateConnection.isPending}
                  onCheckedChange={async (checked) => {
                    try {
                      await updateConnection.mutateAsync({ is_active: checked });
                      if (checked && organizationId) {
                        const queued = await retryGoogleAdsUploadsForConvertedLeads(organizationId);
                        if (queued > 0) {
                          toast.message(
                            t("omnichannel.settings.googleAds.retryUploadsToast", {
                              count: queued,
                              defaultValue:
                                "Mengirim ulang {{count}} lead Converted ke Google Ads. Refresh tabel leads setelah beberapa detik.",
                            }),
                          );
                        } else {
                          toast.success(
                            t(
                              "omnichannel.settings.googleAds.uploadsEnabledOnToast",
                              "Upload offline conversion aktif. Lead Converted baru akan otomatis dikirim.",
                            ),
                          );
                        }
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!oauthConnected || testConnection.isPending}
                  onClick={async () => {
                    try {
                      const res = (await testConnection.mutateAsync()) as {
                        ok?: boolean;
                        error?: string;
                        accessibleCustomerIds?: string[];
                      };
                      if (res?.ok) {
                        toast.success(t("omnichannel.settings.googleAds.testOk"));
                        return;
                      }
                      const ids = res.accessibleCustomerIds ?? [];
                      const base = res.error ?? t("omnichannel.settings.googleAds.testFailed");
                      if (ids.length > 0) {
                        toast.error(
                          t("omnichannel.settings.googleAds.testFailedWithAccessible", {
                            message: base,
                            ids: ids.join(", "),
                          }),
                          { duration: 12_000 },
                        );
                      } else {
                        toast.error(base);
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {testConnection.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("omnichannel.settings.googleAds.testButton")}
                </Button>
                <span className="text-xs text-muted-foreground">{lastTestLabel}</span>
              </div>
            </section>

            {oauthConnected ? (
            <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("omnichannel.settings.googleAds.accountsTitle")}</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!oauthConnected || syncAccessibleAccounts.isPending}
                    onClick={async () => {
                      try {
                        const result = await syncAccessibleAccounts.mutateAsync();
                        const imported = result.imported ?? 0;
                        if (imported > 0) {
                          toast.success(
                            t("omnichannel.settings.googleAds.syncImported", {
                              defaultValue: "Imported {{count}} account(s).",
                              count: imported,
                            }),
                          );
                        } else {
                          toast.message(
                            t("omnichannel.settings.googleAds.syncUpToDate", {
                              defaultValue: "No new accounts to import from Google.",
                            }),
                          );
                        }
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {syncAccessibleAccounts.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-4 w-4" />
                    )}
                    {t("omnichannel.settings.googleAds.syncFromGoogle", "Sync from Google")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={!oauthConnected} onClick={openAddAccount}>
                    <Plus className="mr-1 h-4 w-4" />
                    {t("omnichannel.settings.googleAds.addAccount")}
                  </Button>
                </div>
              </div>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("omnichannel.settings.googleAds.noAccounts")}</p>
              ) : (
                <ul className="space-y-2">
                  {accounts.map((acc) => (
                    <li
                      key={acc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {acc.label || acc.customer_id}
                          {acc.is_default ? (
                            <span className="ml-2 text-xs text-primary">
                              ({t("omnichannel.settings.googleAds.defaultBadge")})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("omnichannel.settings.googleAds.customerConversionLine", {
                            customerId: acc.customer_id,
                            conversionId: acc.conversion_action_id,
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!acc.is_default ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setDefaultAccount.mutate(acc.id)}
                          >
                            {t("omnichannel.settings.googleAds.setDefault")}
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="ghost" onClick={() => openEditAccount(acc.id)}>
                          {t("common.edit", "Edit")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={async () => {
                            try {
                              await deleteAccount.mutateAsync(acc.id);
                              toast.success(t("omnichannel.settings.googleAds.accountDeleted"));
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editAccountId
                ? t("omnichannel.settings.googleAds.editAccountTitle")
                : t("omnichannel.settings.googleAds.addAccountTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("omnichannel.settings.googleAds.accountLabel")}</Label>
              <Input value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleLoadCustomers}>
                {t("omnichannel.settings.googleAds.loadCustomers")}
              </Button>
            </div>
            {pickerCustomers.length > 0 ? (
              <div className="space-y-1">
                <Label>{t("omnichannel.settings.googleAds.pickCustomer")}</Label>
                <Select value={accountCustomerId || undefined} onValueChange={handleCustomerPick}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("omnichannel.settings.googleAds.pickCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pickerCustomers.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>{t("omnichannel.settings.googleAds.customerId")}</Label>
              <Input
                value={accountCustomerId}
                onChange={(e) => setAccountCustomerId(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("omnichannel.settings.googleAds.conversionActionId")}</Label>
              <Input
                value={accountConversionId}
                onChange={(e) => setAccountConversionId(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={accountIsDefault} onCheckedChange={setAccountIsDefault} id="acc-default" />
              <Label htmlFor="acc-default">{t("omnichannel.settings.googleAds.defaultAccount")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" disabled={upsertAccount.isPending} onClick={handleSaveAccount}>
              {t("common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
