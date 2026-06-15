import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import {
  enableXenditForOrg,
  verifyXenditConnection,
} from "@/xendit/lib/xenditApi";
import { CreateXenditSubAccountDialog } from "@/4-0-xendit-settings/components/CreateXenditSubAccountDialog";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type XenditSettingsPanelProps = {
  layout?: "sidebar" | "page" | "standalone";
};

export function XenditSettingsPanel({ layout = "page" }: XenditSettingsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data, isLoading, isFetching } = useXenditOrgSettings(organizationId);
  const [busy, setBusy] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    balance: { ok: boolean; message: string };
    xenPlatform: { ok: boolean; message: string };
    summary: string;
  } | null>(null);

  const isSidebar = layout === "sidebar";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
  };

  const handleToggle = async (enabled: boolean) => {
    if (!organizationId) return;
    setBusy(true);
    try {
      await enableXenditForOrg(organizationId, enabled);
      toast.success(enabled ? t("xendit.enabled", "Xendit enabled") : t("xendit.disabled", "Xendit disabled"));
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!organizationId) return;
    setBusy(true);
    setVerifyResult(null);
    try {
      const result = await verifyXenditConnection(organizationId);
      setVerifyResult({
        balance: result.balance,
        xenPlatform: result.xenPlatform,
        summary: result.summary,
      });
      if (result.ok) {
        toast.success(t("xendit.verifyOk", "Xendit connection OK"));
      } else {
        toast.error(result.summary);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-3", isSidebar ? "p-3" : "space-y-4 p-4")}>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (!data?.serverConfigured) {
    return (
      <div className={isSidebar ? "p-3" : "p-4"}>
        <Alert variant="destructive">
          <AlertTitle>{t("xendit.serverNotConfiguredTitle", "Server not configured")}</AlertTitle>
          <AlertDescription>
            {t(
              "xendit.serverNotConfigured",
              "Xendit is not configured on the server. Set XENDIT_SECRET_KEY in Supabase secrets.",
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasSubAccount = Boolean(data.account?.xendit_sub_account_id);

  const settingsBody = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label className={cn(isSidebar && "text-xs leading-snug")}>
            {t("xendit.enableLabel", "Enable Xendit for this organization")}
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {data.isSandbox ? t("xendit.sandboxMode", "Sandbox mode") : t("xendit.productionMode", "Production")}
            {data.keyKind && data.keyKind !== "unknown" ? ` · ${data.keyKind}` : null}
          </p>
        </div>
        <Switch
          checked={Boolean(data.account?.is_enabled)}
          disabled={busy || isFetching}
          onCheckedChange={handleToggle}
          className="shrink-0"
        />
      </div>

      <div className="grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("xendit.subAccountStatus", "Sub-account")}</span>
          <Badge variant={data.account?.xendit_sub_account_id ? "default" : "secondary"} className="text-[10px]">
            {data.account?.status ?? "—"}
          </Badge>
        </div>
        {data.account?.xendit_sub_account_id ? (
          <p className="font-mono text-[10px] break-all text-gray-700">
            {data.account.xendit_sub_account_id}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("xendit.platformFee", "Platform fee")}</span>
          <span className="font-medium">
            Rp {data.platformConfig?.flat_fee_amount?.toLocaleString("id-ID") ?? "2.500"}
            <span className="text-muted-foreground font-normal">
              {" "}
              {t("xendit.platformFeePerVa", "per transaksi VA")}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("xendit.platformFeeSplit", "Pemotongan fee")}</span>
          <Badge
            variant={data.platformSplitReady ? "default" : "secondary"}
            className="text-[10px]"
          >
            {data.platformSplitReady
              ? t("xendit.platformSplitActive", "Otomatis aktif")
              : t("xendit.platformSplitPending", "Menunggu platform")}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t(
            "xendit.platformFeeAutoHint",
            "Biaya platform dipotong otomatis dari setiap pembayaran VA. Tidak perlu konfigurasi manual.",
          )}
        </p>
      </div>

      <div className={cn("flex gap-2", isSidebar ? "flex-col" : "flex-wrap")}>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || isFetching}
          onClick={handleVerify}
          className={cn(isSidebar && "h-8 w-full justify-center text-xs")}
        >
          {t("xendit.testConnection", "Test connection")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || isFetching || hasSubAccount || !data.account?.is_enabled}
          onClick={() => setCreateDialogOpen(true)}
          className={cn(isSidebar && "h-8 w-full justify-center text-xs")}
        >
          {hasSubAccount
            ? t("xendit.subAccountExists", "Sub-account active")
            : t("xendit.createSubAccount", "Create sub-account")}
        </Button>
      </div>

      {verifyResult ? (
        <div className="rounded-md border border-gray-200 bg-white/80 p-2.5 text-[10px] space-y-1">
          <p>
            <span className="font-medium">{t("xendit.verifyBalance", "API key")}: </span>
            {verifyResult.balance.ok ? "✓ " : "✗ "}
            {verifyResult.balance.message}
          </p>
          <p>
            <span className="font-medium">{t("xendit.verifyXen", "xenPlatform")}: </span>
            {verifyResult.xenPlatform.ok ? "✓ " : "✗ "}
            {verifyResult.xenPlatform.message}
          </p>
          <p className="text-muted-foreground pt-0.5">{verifyResult.summary}</p>
        </div>
      ) : null}
    </div>
  );

  if (isSidebar) {
    return (
      <>
        <div className="border-t border-gray-200/80 p-3">{settingsBody}</div>
        <CreateXenditSubAccountDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          account={data.account}
        />
      </>
    );
  }

  return (
    <>
      {settingsBody}
      <CreateXenditSubAccountDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        account={data.account}
      />
    </>
  );
}
