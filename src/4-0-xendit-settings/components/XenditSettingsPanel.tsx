import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { requestXenditSubAccount, verifyXenditConnection } from "@/xendit/lib/xenditApi";
import { CreateXenditSubAccountDialog } from "@/4-0-xendit-settings/components/CreateXenditSubAccountDialog";
import { XenditBusinessVerificationSection } from "@/4-0-xendit-settings/components/XenditBusinessVerificationSection";
import { XenditKycEditModal } from "@/4-0-xendit-settings/components/XenditKycEditModal";
import { XenditSubAccountsTable } from "@/4-0-xendit-settings/components/XenditSubAccountsTable";
import { kycDocumentsComplete, kycUsableForSubAccount } from "@/xendit/lib/xenditKycUtils";
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
  const isMobile = useIsMobile();
  const { data, isLoading, isFetching } = useXenditOrgSettings(organizationId);
  const { secureEnableXendit } = useSecureXenditActions();
  const [busy, setBusy] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [kycEditModalOpen, setKycEditModalOpen] = useState(false);
  const [editSubAccountRowId, setEditSubAccountRowId] = useState<string | null>(null);
  const [pendingAccountType, setPendingAccountType] = useState<"OWNED" | "MANAGED">("MANAGED");

  const isSidebar = layout === "sidebar";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
  };

  const handleToggle = async (enabled: boolean) => {
    if (!organizationId) return;
    setBusy(true);
    try {
      await secureEnableXendit(organizationId, enabled);
      toast.success(
        enabled ? t("xendit.enabled", "Xendit diaktifkan") : t("xendit.disabled", "Xendit dinonaktifkan"),
      );
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
    try {
      const result = await verifyXenditConnection(organizationId);
      if (result.ok) {
        toast.success(t("xendit.verifyOk", "Koneksi Xendit OK"));
      } else {
        toast.error(result.summary);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddSubAccount = async () => {
    if (!organizationId || isMobile) return;
    setBusy(true);
    try {
      const gate = await requestXenditSubAccount(organizationId);
      setPendingAccountType(gate.account_type);
      const kycComplete = kycDocumentsComplete(data?.kyc ?? null);

      if (gate.require_kyc && Boolean(data?.kyc) && !kycComplete) {
        toast.error(
          gate.message ??
            t(
              "xendit.kyc.incompleteDocuments",
              "Lengkapi dokumen legalitas (termasuk Service Agreement) melalui tombol Lengkapi dokumen.",
            ),
        );
      } else if (gate.can_create) {
        setCreateDialogOpen(true);
      } else {
        toast.error(gate.message ?? t("xendit.kyc.gateBlocked", "Tidak dapat membuat akun"));
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
          <AlertTitle>{t("xendit.serverNotConfiguredTitle", "Server belum dikonfigurasi")}</AlertTitle>
          <AlertDescription>
            {t(
              "xendit.serverNotConfigured",
              "Xendit belum dikonfigurasi di server. Set XENDIT_SECRET_KEY di Supabase secrets.",
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const subAccounts = data.subAccounts ?? [];
  const isEnabled = Boolean(data.account?.is_enabled);
  const kycComplete = kycDocumentsComplete(data?.kyc ?? null);
  const canAddSubAccount =
    data.isInternalOrg || kycUsableForSubAccount(data?.kyc ?? null);
  const showBusinessVerification =
    !data.isInternalOrg &&
    isEnabled &&
    !isMobile &&
    subAccounts.length === 0 &&
    !canAddSubAccount;
  const showSubAccountsSection = !showBusinessVerification;

  const settingsBody = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label className={cn(isSidebar && "text-xs leading-snug")}>
            {t("xendit.enableLabel", "Aktifkan Xendit untuk organisasi ini")}
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {data.isSandbox ? t("xendit.sandboxMode", "Mode sandbox") : t("xendit.productionMode", "Produksi")}
            {data.keyKind && data.keyKind !== "unknown" ? ` · ${data.keyKind}` : null}
            {data.isInternalOrg ? ` · ${t("xendit.kyc.internalOrg", "Org internal")}` : null}
          </p>
        </div>
        <Switch
          checked={isEnabled}
          disabled={busy || isFetching}
          onCheckedChange={handleToggle}
          className="shrink-0"
        />
      </div>

      {showBusinessVerification ? (
        <XenditBusinessVerificationSection disabled={busy || isFetching} />
      ) : null}

      {showSubAccountsSection ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800">
              {t("xendit.kyc.subAccountsTitle", "Bisnis terdaftar di Xendit")}
            </span>
            {!isMobile && canAddSubAccount ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || isFetching || !isEnabled}
                onClick={() => void handleAddSubAccount()}
                className="h-8 text-xs"
              >
                {t("xendit.kyc.addSubAccount", "Daftarkan bisnis baru")}
              </Button>
            ) : null}
          </div>
          {isMobile ? (
            <p className="text-xs text-muted-foreground">
              {t("xendit.kyc.desktopOnly", "Kelola akun Xendit dari desktop.")}
            </p>
          ) : (
            <XenditSubAccountsTable
              subAccounts={subAccounts}
              disabled={busy || isFetching}
              kycDocumentsComplete={kycComplete}
              onCompleteDocuments={(rowId) => {
                setEditSubAccountRowId(rowId);
                setKycEditModalOpen(true);
              }}
            />
          )}
        </div>
      ) : null}

      {showSubAccountsSection && subAccounts.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t(
            "xendit.platformFeeCompact",
            "Biaya platform Rp {{amount}} per transaksi VA, dipotong otomatis.",
            {
              amount: (data.platformConfig?.flat_fee_amount ?? 2500).toLocaleString("id-ID"),
            },
          )}
        </p>
      ) : null}

      {showSubAccountsSection && subAccounts.length === 0 && canAddSubAccount ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            {t(
              "xendit.platformFeeCompact",
              "Biaya platform Rp {{amount}} per transaksi VA, dipotong otomatis.",
              {
                amount: (data.platformConfig?.flat_fee_amount ?? 2500).toLocaleString("id-ID"),
              },
            )}
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={busy || isFetching}
            onClick={() => void handleVerify()}
            className="h-auto px-0 text-[11px] text-muted-foreground"
          >
            {t("xendit.testConnection", "Uji koneksi")}
          </Button>
        </div>
      ) : null}
    </div>
  );

  const dialogs = (
    <>
      <CreateXenditSubAccountDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        accountType={pendingAccountType}
        defaultBusinessName={subAccounts.length > 0 ? "" : (data.account?.business_name ?? "")}
        defaultEmail={subAccounts.length > 0 ? "" : (data.account?.email ?? "")}
      />
      <XenditKycEditModal
        open={kycEditModalOpen}
        onOpenChange={setKycEditModalOpen}
        subAccountRowId={editSubAccountRowId}
        initialKyc={data?.kyc ?? null}
      />
    </>
  );

  if (isSidebar) {
    return (
      <>
        <div className="border-t border-gray-200/80 p-3">{settingsBody}</div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      {settingsBody}
      {dialogs}
    </>
  );
}
