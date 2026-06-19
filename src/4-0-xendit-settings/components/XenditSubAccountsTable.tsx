import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useSecureXenditActions } from "@/xendit/hooks/useSecureXenditActions";
import { retryXenditSubAccountDocuments } from "@/xendit/lib/xenditApi";
import type { XenditSubAccountRow } from "@/xendit/types/xendit";

type XenditSubAccountsTableProps = {
  subAccounts: XenditSubAccountRow[];
  disabled?: boolean;
  kycDocumentsComplete?: boolean;
  onCompleteDocuments?: (subAccountRowId: string) => void;
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "failed" || status === "suspended") return "destructive";
  return "secondary";
}

function docStatusLabel(
  status: string,
  t: (key: string, fallback: string) => string,
): string {
  switch (status) {
    case "completed":
      return t("xendit.kyc.docCompleted", "Dokumen terkirim");
    case "failed":
      return t("xendit.kyc.docFailed", "Upload gagal");
    case "pending":
      return t("xendit.kyc.docPending", "Memverifikasi legalitas");
    default:
      return t("xendit.kyc.docNotRequired", "—");
  }
}

function needsCompleteDocuments(row: XenditSubAccountRow, kycDocumentsComplete: boolean): boolean {
  if (row.account_type !== "MANAGED") return false;
  if (kycDocumentsComplete) return false;
  return row.document_upload_status === "failed" || row.document_upload_status === "pending";
}

export function XenditSubAccountsTable({
  subAccounts,
  disabled,
  kycDocumentsComplete = false,
  onCompleteDocuments,
}: XenditSubAccountsTableProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { secureSetPrimarySubAccount } = useSecureXenditActions();
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["xendit-settings", organizationId] });
  };

  const handleSetPrimary = async (rowId: string) => {
    if (!organizationId) return;
    setBusyId(rowId);
    try {
      await secureSetPrimarySubAccount(organizationId, rowId);
      toast.success(t("xendit.kyc.primarySet", "Akun utama diperbarui"));
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleRetryDocs = async (rowId: string) => {
    if (!organizationId) return;
    setBusyId(rowId);
    try {
      const res = await retryXenditSubAccountDocuments(organizationId, rowId);
      if (res.ok) {
        toast.success(t("xendit.kyc.retryOk", "Dokumen berhasil dikirim ulang ke Xendit"));
      } else {
        toast.error(res.error ?? t("xendit.kyc.retryFailed", "Upload dokumen gagal"));
      }
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (subAccounts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          "xendit.kyc.noSubAccounts",
          "Belum ada bisnis terdaftar. Daftarkan bisnis baru setelah verifikasi selesai.",
        )}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white/80">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">{t("xendit.subAccountEmail", "Email")}</TableHead>
            <TableHead className="text-xs">{t("xendit.kyc.type", "Tipe")}</TableHead>
            <TableHead className="text-xs">{t("xendit.subAccountStatus", "Status")}</TableHead>
            <TableHead className="text-xs">{t("xendit.kyc.legalStatus", "Legalitas")}</TableHead>
            <TableHead className="text-xs text-right">{t("common.actions", "Aksi")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subAccounts.map((row) => {
            const rowBusy = busyId === row.id;
            const showComplete = needsCompleteDocuments(row, kycDocumentsComplete);
            const showRetry = row.document_upload_status === "failed" && kycDocumentsComplete;

            return (
              <TableRow key={row.id}>
                <TableCell className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{row.email}</span>
                    <span className="text-[10px] text-muted-foreground">{row.business_name}</span>
                    {row.is_primary ? (
                      <Badge variant="outline" className="w-fit text-[9px]">
                        {t("xendit.kyc.primary", "Utama")}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{row.account_type}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant={statusBadgeVariant(row.status)} className="text-[10px]">
                    {row.status === "pending"
                      ? t("xendit.kyc.statusPending", "Memverifikasi")
                      : row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {docStatusLabel(row.document_upload_status, t)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {!row.is_primary ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={disabled || rowBusy}
                        onClick={() => void handleSetPrimary(row.id)}
                      >
                        {t("xendit.kyc.setPrimary", "Jadikan utama")}
                      </Button>
                    ) : null}
                    {showComplete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 text-[10px]"
                        disabled={disabled || rowBusy}
                        onClick={() => onCompleteDocuments?.(row.id)}
                      >
                        {t("xendit.kyc.completeDocuments", "Lengkapi dokumen")}
                      </Button>
                    ) : null}
                    {showRetry ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[10px]"
                        disabled={disabled || rowBusy}
                        onClick={() => void handleRetryDocs(row.id)}
                      >
                        {t("xendit.kyc.retryUpload", "Coba upload ulang")}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
