import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import type { OmnichannelApiTokenRow } from "@/5-3-dashboard/omnichannel-settings/hooks/useOmnichannelApiIntegration";

type ApiTokenRevokeDialogProps = {
  token: OmnichannelApiTokenRow | null;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ApiTokenRevokeDialog({
  token,
  open,
  loading,
  onOpenChange,
  onConfirm,
}: ApiTokenRevokeDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("omnichannel.settings.apiIntegration.revokeConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t("omnichannel.settings.apiIntegration.revokeConfirmBody")}</p>
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
                      {t("omnichannel.settings.apiIntegration.colLastUsed")}
                    </dt>
                    <dd>
                      {token.last_used_at
                        ? new Date(token.last_used_at).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {t("omnichannel.settings.apiIntegration.revoke")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
