import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ApiTokenCreateDialog } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ApiTokenCreateDialog";
import { ApiTokenRevokeDialog } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ApiTokenRevokeDialog";
import { ClickInfoHint } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ClickInfoHint";
import { ApiIntegrationDocsPanel } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ApiIntegrationDocsPanel";
import {
  getDefaultApiBaseUrl,
  getOmnichannelTokenDisplayStatus,
  getOmnichannelTokenExpiryState,
  isOmnichannelTokenCurrentlyActive,
  sortOmnichannelApiTokensForDisplay,
  useCreateOmnichannelApiToken,
  useOmnichannelApiSettings,
  useOmnichannelApiTokens,
  useRevokeOmnichannelApiToken,
  useUpdateOmnichannelApiSettings,
  type OmnichannelApiTokenRow,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import {
  OMNICHANNEL_SETTINGS_CARD_HEADER_BASE,
  OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS,
  OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS,
} from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsCardHeader";
import { cn } from "@/shared/lib/utils";

const panelScrollClass =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function mutationErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return undefined;
}

export function ApiIntegrationSection() {
  const { t } = useTranslation();
  const { organizationId } = useActiveOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "docs" ? "docs" : "tokens";

  const [createOpen, setCreateOpen] = useState(false);
  const [plaintextToken, setPlaintextToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OmnichannelApiTokenRow | null>(null);
  const [waTemplate, setWaTemplate] = useState("");
  const [waTemplateDirty, setWaTemplateDirty] = useState(false);

  const tokensTabEnabled = tab === "tokens";

  const {
    data: tokens = [],
    isLoading: tokensLoading,
    isError: tokensError,
  } = useOmnichannelApiTokens(organizationId, { enabled: tokensTabEnabled });
  const { data: settings, isLoading: settingsLoading } = useOmnichannelApiSettings(organizationId, {
    enabled: tokensTabEnabled,
  });
  const createToken = useCreateOmnichannelApiToken(organizationId);
  const revokeToken = useRevokeOmnichannelApiToken(organizationId);
  const updateSettings = useUpdateOmnichannelApiSettings(organizationId);

  const apiBase = useMemo(() => getDefaultApiBaseUrl(), []);

  const sortedTokens = useMemo(() => sortOmnichannelApiTokensForDisplay(tokens), [tokens]);

  const tokenCounts = useMemo(() => {
    let active = 0;
    let revoked = 0;
    for (const tok of tokens) {
      if (isOmnichannelTokenCurrentlyActive(tok)) active += 1;
      else if (!tok.is_active) revoked += 1;
    }
    return { active, revoked };
  }, [tokens]);

  useEffect(() => {
    setWaTemplate("");
    setWaTemplateDirty(false);
  }, [organizationId]);

  useEffect(() => {
    if (!waTemplateDirty) {
      setWaTemplate(settings?.default_whatsapp_invoice_template_name ?? "");
    }
  }, [settings?.default_whatsapp_invoice_template_name, waTemplateDirty]);

  const setTab = (value: string) => {
    if (value === "docs") {
      setSearchParams({ tab: "docs" });
    } else {
      setSearchParams({});
    }
  };

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("omnichannel.settings.apiIntegration.copied", { label }));
    } catch {
      toast.error(t("omnichannel.settings.apiIntegration.copyFailed"));
    }
  }

  async function handleSaveSettings() {
    try {
      await updateSettings.mutateAsync({
        default_whatsapp_invoice_template_name: waTemplate.trim() || null,
      });
      setWaTemplateDirty(false);
      toast.success(t("omnichannel.settings.apiIntegration.settingsSaved"));
    } catch (error) {
      toast.error(
        mutationErrorMessage(error) ?? t("omnichannel.settings.apiIntegration.settingsSaveFailed"),
      );
    }
  }

  async function handleOfflineConversionChange(checked: boolean) {
    try {
      await updateSettings.mutateAsync({ offline_conversion_enabled: checked });
    } catch (error) {
      toast.error(
        mutationErrorMessage(error) ??
          t("omnichannel.settings.apiIntegration.offlineConversionUpdateFailed"),
      );
    }
  }

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;
    try {
      await revokeToken.mutateAsync(revokeTarget.id);
      toast.success(t("omnichannel.settings.apiIntegration.revoked"));
      setRevokeTarget(null);
    } catch (error) {
      toast.error(
        mutationErrorMessage(error) ?? t("omnichannel.settings.apiIntegration.revokeFailed"),
      );
    }
  }

  function renderTokenStatus(tok: OmnichannelApiTokenRow) {
    const status = getOmnichannelTokenDisplayStatus(tok);
    if (status === "active") {
      return (
        <Badge variant="secondary" className="font-normal">
          {t("omnichannel.settings.apiIntegration.statusActive")}
        </Badge>
      );
    }
    if (status === "expired") {
      return (
        <Badge variant="outline" className="border-destructive/40 font-normal text-destructive">
          {t("omnichannel.settings.apiIntegration.expiredBadge")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        {t("omnichannel.settings.apiIntegration.revokedBadge")}
      </Badge>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={cn(OMNICHANNEL_SETTINGS_CARD_HEADER_BASE, "flex flex-col justify-center shrink-0")}>
        <h3 className={OMNICHANNEL_SETTINGS_CARD_TITLE_CLASS}>
          {t("omnichannel.settings.apiIntegration.title")}
        </h3>
        <p className={OMNICHANNEL_SETTINGS_CARD_SUBTITLE_CLASS}>
          {t("omnichannel.settings.apiIntegration.subtitle")}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4">
        <TabsList className="mb-3 w-fit shrink-0">
          <TabsTrigger value="tokens">{t("omnichannel.settings.apiIntegration.tabTokens")}</TabsTrigger>
          <TabsTrigger value="docs">{t("omnichannel.settings.apiIntegration.tabDocs")}</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <div className={`${panelScrollClass} space-y-5`}>
            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t("omnichannel.settings.apiIntegration.orgSettingsTitle")}
                  </h4>
                  <ClickInfoHint
                    content={t("omnichannel.settings.apiIntegration.orgSettingsDescription")}
                  />
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="max-w-lg space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="wa-template">
                      {t("omnichannel.settings.apiIntegration.waTemplateLabel")}
                    </Label>
                    <ClickInfoHint
                      content={t("omnichannel.settings.apiIntegration.waTemplateHint")}
                    />
                  </div>
                  <Input
                    id="wa-template"
                    value={waTemplate}
                    onChange={(e) => {
                      setWaTemplateDirty(true);
                      setWaTemplate(e.target.value);
                    }}
                    placeholder="invoice_receipt"
                    disabled={settingsLoading || updateSettings.isPending}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-1">
                    <Label htmlFor="offline-conv" className="text-sm font-medium leading-snug">
                      {t("omnichannel.settings.apiIntegration.offlineConversion")}
                    </Label>
                    <ClickInfoHint
                      content={t("omnichannel.settings.apiIntegration.offlineConversionHint")}
                    />
                  </div>
                  <Switch
                    id="offline-conv"
                    className="shrink-0"
                    checked={settings?.offline_conversion_enabled !== false}
                    disabled={settingsLoading || updateSettings.isPending}
                    onCheckedChange={(checked) => {
                      void handleOfflineConversionChange(checked);
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-border/60 bg-muted/10 px-4 py-3">
                <Button
                  size="sm"
                  variant={waTemplateDirty ? "default" : "secondary"}
                  disabled={!waTemplateDirty || settingsLoading || updateSettings.isPending}
                  onClick={() => {
                    void handleSaveSettings();
                  }}
                >
                  {t("omnichannel.settings.apiIntegration.saveSettings")}
                </Button>
              </div>
            </section>

            {plaintextToken ? (
              <div className="rounded-lg border border-amber-300/80 bg-amber-50/80 p-4 dark:border-amber-700/60 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t("omnichannel.settings.apiIntegration.tokenOnceHint")}
                </p>
                <code className="mt-2 block break-all rounded-md border border-amber-200/80 bg-background/90 p-2.5 font-mono text-xs dark:border-amber-800/60">
                  {plaintextToken}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyText(plaintextToken, "Token")}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    {t("omnichannel.settings.apiIntegration.copyToken")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPlaintextToken(null)}>
                    {t("omnichannel.settings.apiIntegration.dismissToken")}
                  </Button>
                </div>
              </div>
            ) : null}

            <section className="space-y-3">
              <div
                className={cn(
                  "rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5",
                  "text-xs text-muted-foreground",
                )}
              >
                <span className="font-medium text-foreground">
                  {t("omnichannel.settings.apiIntegration.baseUrl")}
                </span>
                <code className="mt-1 block break-all font-mono text-[11px] leading-relaxed text-foreground">
                  {apiBase}
                </code>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t("omnichannel.settings.apiIntegration.tokensSectionTitle")}
                  </h4>
                  {!tokensLoading && tokens.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("omnichannel.settings.apiIntegration.tokenCountSummary", {
                        active: tokenCounts.active,
                        revoked: tokenCounts.revoked,
                      })}
                    </span>
                  ) : null}
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t("omnichannel.settings.apiIntegration.createToken")}
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("omnichannel.settings.apiIntegration.colLabel")}</TableHead>
                    <TableHead>web_id</TableHead>
                    <TableHead>{t("omnichannel.settings.apiIntegration.colPrefix")}</TableHead>
                    <TableHead>{t("omnichannel.settings.apiIntegration.colStatus")}</TableHead>
                    <TableHead>{t("omnichannel.settings.apiIntegration.colExpiry")}</TableHead>
                    <TableHead>{t("omnichannel.settings.apiIntegration.colLastUsed")}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokensLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : tokensError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-destructive">
                        {t("omnichannel.settings.apiIntegration.loadFailed")}
                      </TableCell>
                    </TableRow>
                  ) : sortedTokens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("omnichannel.settings.apiIntegration.noTokens")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTokens.map((tok) => {
                      const expiryState = getOmnichannelTokenExpiryState(tok.expires_at);
                      const isExpired = expiryState === "expired";
                      const displayStatus = getOmnichannelTokenDisplayStatus(tok);
                      const rowInactive = displayStatus !== "active";
                      return (
                      <TableRow key={tok.id} className={rowInactive ? "opacity-60" : undefined}>
                        <TableCell>{tok.label || "—"}</TableCell>
                        <TableCell>
                          <code className="text-xs">{tok.web_id}</code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{tok.token_prefix}…</code>
                        </TableCell>
                        <TableCell>{renderTokenStatus(tok)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {!tok.is_active && tok.revoked_at ? (
                            <span>
                              {t("omnichannel.settings.apiIntegration.revokedAt", {
                                date: new Date(tok.revoked_at).toLocaleString(),
                              })}
                            </span>
                          ) : expiryState === "none" ? (
                            t("omnichannel.settings.apiIntegration.expiryNoneShort")
                          ) : isExpired ? (
                            <span className="font-medium text-destructive">
                              {new Date(tok.expires_at!).toLocaleString()}
                            </span>
                          ) : (
                            new Date(tok.expires_at!).toLocaleString()
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {tok.last_used_at ? new Date(tok.last_used_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          {tok.is_active && !isExpired ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={revokeToken.isPending}
                              aria-label={t("omnichannel.settings.apiIntegration.revoke")}
                              onClick={() => setRevokeTarget(tok)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ApiIntegrationDocsPanel apiBase={apiBase} />
        </TabsContent>
      </Tabs>

      <ApiTokenCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        loading={createToken.isPending}
        existingTokens={tokens}
        orgDefaultWaTemplate={
          settings?.default_whatsapp_invoice_template_name ??
          (waTemplate.trim() || null)
        }
        onSubmit={async (payload) => {
          try {
            const res = await createToken.mutateAsync(payload);
            const plain = String(res.plaintext_token ?? "");
            if (plain) setPlaintextToken(plain);
            setCreateOpen(false);
            toast.success(t("omnichannel.settings.apiIntegration.tokenCreated"));
          } catch (error) {
            const message = mutationErrorMessage(error);
            const isLimit =
              message?.includes("Batas token aktif") ||
              message?.includes("Active token limit") ||
              message?.includes("LIMIT_EXCEEDED");
            toast.error(
              isLimit
                ? t("omnichannel.settings.apiIntegration.createTokenLimitFailed")
                : message ?? t("omnichannel.settings.apiIntegration.createTokenFailed"),
            );
            throw error;
          }
        }}
      />

      <ApiTokenRevokeDialog
        token={revokeTarget}
        open={revokeTarget != null}
        loading={revokeToken.isPending}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        onConfirm={() => {
          void handleConfirmRevoke();
        }}
      />
    </div>
  );
}
