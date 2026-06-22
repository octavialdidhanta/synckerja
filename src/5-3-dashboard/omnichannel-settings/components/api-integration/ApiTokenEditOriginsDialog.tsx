import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/shared/components/ui/badge";
import { ClickInfoHint } from "@/5-3-dashboard/omnichannel-settings/components/api-integration/ClickInfoHint";
import type { OmnichannelApiTokenRow } from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";
import {
  originsListsEqual,
  parseOriginsFromText,
} from "@/5-3-dashboard/omnichannel-settings/lib/omnichannelTokenOrigins";

type ApiTokenEditOriginsDialogProps = {
  token: OmnichannelApiTokenRow | null;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (allowed_origins: string[]) => Promise<void>;
};

export function ApiTokenEditOriginsDialog({
  token,
  open,
  loading,
  onOpenChange,
  onSubmit,
}: ApiTokenEditOriginsDialogProps) {
  const { t } = useTranslation();
  const [originsText, setOriginsText] = useState("");

  const initialOrigins = useMemo(
    () => (token?.allowed_origins ?? []).map((o) => o.trim()).filter(Boolean),
    [token],
  );

  const parsedOrigins = useMemo(() => parseOriginsFromText(originsText), [originsText]);

  const unchanged = originsListsEqual(parsedOrigins, initialOrigins);
  const canSubmit = parsedOrigins.length > 0 && !unchanged;

  useEffect(() => {
    if (open && token) {
      setOriginsText(initialOrigins.join(", "));
    }
    if (!open) {
      setOriginsText("");
    }
  }, [open, token, initialOrigins]);

  async function handleSubmit() {
    if (!canSubmit) return;
    await onSubmit(parsedOrigins);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("omnichannel.settings.apiIntegration.editOriginsTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            {t("omnichannel.settings.apiIntegration.editOriginsBody")}
          </p>

          {token ? (
            <dl className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="font-medium text-foreground">
                  {t("omnichannel.settings.apiIntegration.colLabel")}
                </dt>
                <dd>{token.label || "—"}</dd>
                <dt className="font-medium text-foreground">web_id</dt>
                <dd>
                  <code>{token.web_id}</code>
                </dd>
                <dt className="font-medium text-foreground">
                  {t("omnichannel.settings.apiIntegration.colPrefix")}
                </dt>
                <dd>
                  <code>{token.token_prefix}…</code>
                </dd>
                <dt className="font-medium text-foreground">
                  {t("omnichannel.settings.apiIntegration.colTokenType")}
                </dt>
                <dd>
                  <Badge variant="secondary" className="font-normal">
                    {t("omnichannel.settings.apiIntegration.tokenTypeSdkShort")}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="edit-api-origins">
                {t("omnichannel.settings.apiIntegration.originsFieldShort")} *
              </Label>
              <ClickInfoHint content={t("omnichannel.settings.apiIntegration.originsHint")} />
            </div>
            <Input
              id="edit-api-origins"
              value={originsText}
              onChange={(e) => setOriginsText(e.target.value)}
              placeholder="https://toko-anda.com"
            />
          </div>

          {unchanged && parsedOrigins.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("omnichannel.settings.apiIntegration.editOriginsNoChangeHint")}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button disabled={loading || !canSubmit} onClick={() => void handleSubmit()}>
            {t("omnichannel.settings.apiIntegration.editOriginsSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
