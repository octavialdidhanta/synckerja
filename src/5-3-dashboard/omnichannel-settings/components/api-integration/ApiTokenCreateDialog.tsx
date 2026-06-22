import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
  countActiveTokensForWebId,
  type OmnichannelApiTokenRow,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";
import { parseOriginsFromText } from "@/5-3-dashboard/omnichannel-settings/lib/omnichannelTokenOrigins";

export type CreateTokenPayload = {
  web_id: string;
  label?: string;
  allowed_origins?: string[];
  expires_in_days?: number;
  token_type: "sdk" | "server";
};

function FieldLabel({
  htmlFor,
  children,
  info,
}: {
  htmlFor?: string;
  children: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{children}</Label>
      {info ? <ClickInfoHint content={info} /> : null}
    </div>
  );
}

export function ApiTokenCreateDialog({
  open,
  onOpenChange,
  loading,
  existingTokens = [],
  orgDefaultWaTemplate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  existingTokens?: OmnichannelApiTokenRow[];
  orgDefaultWaTemplate?: string | null;
  onSubmit: (payload: CreateTokenPayload) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [webId, setWebId] = useState("");
  const [label, setLabel] = useState("");
  const [tokenType, setTokenType] = useState<"sdk" | "server">("sdk");
  const [origins, setOrigins] = useState("");
  const [expiryDays, setExpiryDays] = useState<string>("none");

  const parsedOrigins = useMemo(() => parseOriginsFromText(origins), [origins]);

  const canSubmit =
    Boolean(webId.trim()) &&
    (tokenType === "server" || parsedOrigins.length > 0);

  const activeWebIdCount = useMemo(
    () => countActiveTokensForWebId(existingTokens, webId),
    [existingTokens, webId],
  );

  const dialogInfo = useMemo(() => {
    const waNote = orgDefaultWaTemplate?.trim()
      ? t("omnichannel.settings.apiIntegration.createTokenWaTemplateNote", {
          template: orgDefaultWaTemplate.trim(),
        })
      : t("omnichannel.settings.apiIntegration.createTokenWaTemplateEmpty");
    return (
      <div className="space-y-2">
        <p>{t("omnichannel.settings.apiIntegration.tokenRotationHint")}</p>
        {tokenType === "sdk" ? (
          <p>{t("omnichannel.settings.apiIntegration.sdkTrafficApprovalHint")}</p>
        ) : null}
        <p>{waNote}</p>
      </div>
    );
  }, [orgDefaultWaTemplate, t, tokenType]);

  useEffect(() => {
    if (!open) {
      setWebId("");
      setLabel("");
      setTokenType("sdk");
      setOrigins("");
      setExpiryDays("none");
    }
  }, [open]);

  async function handleSubmit() {
    const normalized = webId.trim().toLowerCase();
    if (!normalized) return;

    const allowed_origins = parsedOrigins;

    await onSubmit({
      web_id: normalized,
      label: label.trim() || undefined,
      token_type: tokenType,
      allowed_origins: tokenType === "sdk" ? allowed_origins : undefined,
      expires_in_days: expiryDays === "none" ? undefined : Number(expiryDays),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1 pr-8">
            <span>{t("omnichannel.settings.apiIntegration.createTokenTitle")}</span>
            <ClickInfoHint content={dialogInfo} side="bottom" align="start" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <FieldLabel info={t("omnichannel.settings.apiIntegration.tokenTypeFieldHint")}>
              {t("omnichannel.settings.apiIntegration.tokenTypeField")}
            </FieldLabel>
            <Select
              value={tokenType}
              onValueChange={(v) => setTokenType(v as "sdk" | "server")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sdk">
                  {t("omnichannel.settings.apiIntegration.tokenTypeSdk")}
                </SelectItem>
                <SelectItem value="server">
                  {t("omnichannel.settings.apiIntegration.tokenTypeServer")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tokenType === "sdk"
                ? t("omnichannel.settings.apiIntegration.tokenTypeSdkHint")
                : t("omnichannel.settings.apiIntegration.tokenTypeServerHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <FieldLabel
                htmlFor="api-web-id"
                info={t("omnichannel.settings.apiIntegration.webIdHint")}
              >
                web_id *
              </FieldLabel>
              {activeWebIdCount > 0 ? (
                <ClickInfoHint
                  content={t("omnichannel.settings.apiIntegration.duplicateWebIdWarning", {
                    count: activeWebIdCount,
                  })}
                  iconClassName="text-amber-600 dark:text-amber-400"
                />
              ) : null}
            </div>
            <Input
              id="api-web-id"
              value={webId}
              onChange={(e) => setWebId(e.target.value)}
              placeholder="toko-anda-com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-label">{t("omnichannel.settings.apiIntegration.labelField")}</Label>
            <Input id="api-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          {tokenType === "sdk" ? (
          <div className="space-y-1.5">
            <FieldLabel
              htmlFor="api-origins"
              info={t("omnichannel.settings.apiIntegration.originsHint")}
            >
              {t("omnichannel.settings.apiIntegration.originsFieldShort")} *
            </FieldLabel>
            <Input
              id="api-origins"
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              placeholder="https://toko-anda.com"
            />
          </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t("omnichannel.settings.apiIntegration.expiryField")}</Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("omnichannel.settings.apiIntegration.expiryNone")}</SelectItem>
                <SelectItem value="30">30 {t("omnichannel.settings.apiIntegration.days")}</SelectItem>
                <SelectItem value="90">90 {t("omnichannel.settings.apiIntegration.days")}</SelectItem>
                <SelectItem value="365">365 {t("omnichannel.settings.apiIntegration.days")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={loading || !canSubmit} onClick={() => void handleSubmit()}>
            {t("omnichannel.settings.apiIntegration.createToken")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
