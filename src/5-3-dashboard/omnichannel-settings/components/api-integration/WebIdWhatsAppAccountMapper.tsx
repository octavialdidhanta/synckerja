import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ClickInfoHint } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ClickInfoHint";
import {
  useUpsertWebIdWhatsAppAccount,
  useWebIdWhatsAppAccounts,
  type WebIdWhatsAppAccountMappingRow,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";
import { useWhatsAppAccounts } from "@/5-3-whatsapp/hooks/useWhatsAppAccounts";

const mapperRowGridClass =
  "grid grid-cols-[3rem_auto_minmax(200px,20rem)] items-center gap-x-2 sm:gap-x-3";

const mapperSelectTriggerBase =
  "h-9 w-full min-w-0 text-left text-sm [&>span:first-child]:block [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:truncate [&>span:first-child]:text-left";

export function accountLabel(
  name: string | null | undefined,
  displayPhone: string | null | undefined,
): string {
  const n = (name ?? "").trim();
  const p = (displayPhone ?? "").trim();
  if (n && p) return `${n} · ${p}`;
  return n || p || "—";
}

function mappingForWebId(
  mappings: WebIdWhatsAppAccountMappingRow[],
  webId: string,
): WebIdWhatsAppAccountMappingRow | undefined {
  return mappings.find((m) => m.is_active && m.web_id === webId);
}

function nestedAccount(
  row: WebIdWhatsAppAccountMappingRow,
): { whatsapp_business_name: string | null; display_phone_number: string | null } | null {
  const nested = row.organization_whatsapp_accounts;
  if (!nested) return null;
  if (Array.isArray(nested)) return nested[0] ?? null;
  return nested;
}

export type WebIdWhatsAppAccountMapperProps = {
  organizationId: string | null | undefined;
  selectedWebId?: string | null;
  onWebIdChange?: (webId: string) => void;
  onMappedAccountIdChange?: (accountId: string | null) => void;
  disabled?: boolean;
  queryEnabled?: boolean;
};

export function WebIdWhatsAppAccountMapper({
  organizationId,
  selectedWebId,
  onWebIdChange,
  onMappedAccountIdChange,
  disabled = false,
  queryEnabled = true,
}: WebIdWhatsAppAccountMapperProps) {
  const { t } = useTranslation();
  const webId = selectedWebId?.trim() ?? "";
  const [accountId, setAccountId] = useState("");
  const lastReportedAccountIdRef = useRef<string | null>(null);

  const { data, isLoading: mappingsLoading } = useWebIdWhatsAppAccounts(organizationId, {
    enabled: queryEnabled,
  });
  const { accounts, isLoading: accountsLoading } = useWhatsAppAccounts();
  const upsert = useUpsertWebIdWhatsAppAccount(organizationId);

  const candidateWebIds = data?.candidate_web_ids ?? [];
  const mappings = data?.mappings ?? [];
  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts]);

  const mappedByWebId = useMemo(() => {
    const map = new Map<string, WebIdWhatsAppAccountMappingRow>();
    for (const row of mappings) {
      if (row.is_active) map.set(row.web_id, row);
    }
    return map;
  }, [mappings]);

  const unmappedWebIds = useMemo(
    () => candidateWebIds.filter((id) => !mappedByWebId.has(id)),
    [candidateWebIds, mappedByWebId],
  );

  useEffect(() => {
    if (!webId) {
      setAccountId("");
      if (lastReportedAccountIdRef.current !== null) {
        lastReportedAccountIdRef.current = null;
        onMappedAccountIdChange?.(null);
      }
      return;
    }
    const existing = mappingForWebId(mappings, webId);
    const nextAccountId = existing?.whatsapp_account_id ?? "";
    setAccountId(nextAccountId);
    const reported = nextAccountId || null;
    if (lastReportedAccountIdRef.current !== reported) {
      lastReportedAccountIdRef.current = reported;
      onMappedAccountIdChange?.(reported);
    }
  }, [webId, mappings, onMappedAccountIdChange]);

  const isLoading = mappingsLoading || accountsLoading;
  const noWebIds = !mappingsLoading && candidateWebIds.length === 0;
  const noAccounts = !accountsLoading && activeAccounts.length === 0;
  const currentMapped = webId ? mappedByWebId.get(webId) : undefined;
  const isDirty =
    Boolean(webId && accountId) &&
    accountId !== (currentMapped?.whatsapp_account_id ?? "");

  async function handleSave() {
    if (!webId || !accountId) return;
    try {
      await upsert.mutateAsync({ web_id: webId, whatsapp_account_id: accountId });
      toast.success(t("omnichannel.settings.apiIntegration.webIdWaMapper.saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(
        message ?? t("omnichannel.settings.apiIntegration.webIdWaMapper.saveFailed"),
      );
    }
  }

  function handleWebIdChange(value: string) {
    onWebIdChange?.(value);
  }

  return (
    <div className="mb-1 rounded-lg border border-border/70 bg-muted/20 p-4 pb-4">
      <div className="mb-3 flex items-center gap-1">
        <h5 className="text-sm font-semibold text-foreground">
          {t("omnichannel.settings.apiIntegration.webIdWaMapper.title")}
        </h5>
        <ClickInfoHint content={t("omnichannel.settings.apiIntegration.webIdWaMapper.hint")} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {t("omnichannel.settings.apiIntegration.webIdWaMapper.subtitle")}
      </p>

      {unmappedWebIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("omnichannel.settings.apiIntegration.webIdWaMapper.unmappedLabel")}
          </span>
          {unmappedWebIds.map((id) => (
            <Badge key={id} variant="outline" className="font-mono text-[11px] font-normal">
              {id}
            </Badge>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      ) : noWebIds ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {t("omnichannel.settings.apiIntegration.webIdWaMapper.noWebIds")}
        </p>
      ) : noAccounts ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {t("omnichannel.settings.apiIntegration.webIdWaMapper.noAccounts")}
        </p>
      ) : (
        <div className="max-w-md space-y-3">
          <div className={mapperRowGridClass}>
            <Label
              htmlFor="web-id-wa-mapper-web-id"
              className="font-mono text-xs font-medium leading-tight text-foreground"
            >
              web_id
            </Label>
            <span className="text-muted-foreground" aria-hidden>
              →
            </span>
            <Select
              value={webId || undefined}
              onValueChange={handleWebIdChange}
              disabled={disabled}
            >
              <SelectTrigger
                id="web-id-wa-mapper-web-id"
                className={`${mapperSelectTriggerBase} font-mono`}
              >
                <SelectValue
                  placeholder={t("omnichannel.settings.apiIntegration.webIdWaMapper.webIdPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {candidateWebIds.map((id) => (
                  <SelectItem key={id} value={id} className="font-mono text-sm">
                    <span className="inline-flex items-center gap-2">
                      {id}
                      {!mappedByWebId.has(id) ? (
                        <Badge variant="secondary" className="font-sans text-[10px] font-normal">
                          {t("omnichannel.settings.apiIntegration.webIdWaMapper.notMappedBadge")}
                        </Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={mapperRowGridClass}>
            <Label
              htmlFor="web-id-wa-mapper-account"
              className="text-xs font-medium leading-tight text-foreground"
            >
              {t("omnichannel.settings.apiIntegration.webIdWaMapper.accountLabel")}
            </Label>
            <span className="text-muted-foreground" aria-hidden>
              →
            </span>
            <Select
              value={accountId || undefined}
              onValueChange={setAccountId}
              disabled={disabled || !webId}
            >
              <SelectTrigger id="web-id-wa-mapper-account" className={mapperSelectTriggerBase}>
                <SelectValue
                  placeholder={t(
                    "omnichannel.settings.apiIntegration.webIdWaMapper.accountPlaceholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id} className="text-sm">
                    {accountLabel(acct.whatsapp_business_name, acct.display_phone_number)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {webId && !currentMapped ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {t("omnichannel.settings.apiIntegration.webIdWaMapper.notMappedWarning")}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant={isDirty ? "default" : "secondary"}
              disabled={disabled || !webId || !accountId || !isDirty || upsert.isPending}
              onClick={() => {
                void handleSave();
              }}
            >
              {upsert.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              {t("omnichannel.settings.apiIntegration.webIdWaMapper.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function labelFromWebIdMapping(
  mappings: WebIdWhatsAppAccountMappingRow[] | undefined,
  webId: string | null | undefined,
): string | null {
  if (!webId?.trim() || !mappings?.length) return null;
  const row = mappingForWebId(mappings, webId.trim());
  if (!row) return null;
  const acct = nestedAccount(row);
  return accountLabel(acct?.whatsapp_business_name, acct?.display_phone_number);
}
