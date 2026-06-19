import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { usePayrollExpenseSettings } from "../hooks/usePayrollExpenseSettings";
import { usePayrollExpensePostStatus } from "../hooks/usePayrollExpensePostStatus";

type Props = {
  runId: string | null;
  runStatus?: string;
};

export function PayrollExpenseStatusBanner({ runId, runStatus }: Props) {
  const { t } = useAppTranslation();
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const { data: settings } = usePayrollExpenseSettings(organizationId);
  const { data: postStatus, isLoading } = usePayrollExpensePostStatus(
    runId,
    Boolean(settings?.is_enabled && runStatus === "paid"),
  );

  if (!settings?.is_enabled || runStatus !== "paid" || !runId) return null;
  if (isLoading) return null;
  if (!postStatus || postStatus.status === "none" || postStatus.status === "skipped") return null;

  if (postStatus.status === "posted") {
    return (
      <div className="mb-2 shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {t("payroll.expense.bannerSuccessTitle", "THP dipost ke Expense Dashboard")}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {t("payroll.expense.bannerSuccessBody", "Total {{amount}} tercatat sebagai expense.", {
                amount: formatToRupiah(postStatus.amount ?? 0),
              })}
            </p>
            <Link
              to={`/expenses/dashboard?payrollRun=${runId}`}
              className="text-primary mt-1 inline-block font-medium hover:underline"
            >
              {t("payroll.expense.viewInDashboard", "Lihat di Expense Dashboard")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (postStatus.status === "failed") {
    return (
      <div className="mb-2 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-destructive font-medium">
              {t("payroll.expense.bannerFailedTitle", "Post THP ke expense gagal")}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {t(
                "payroll.expense.bannerFailedBody",
                "Tipe/kategori expense tidak ditemukan. Buat Fixed Expenses + Gaji Karyawan Tetap di pengaturan expense, lalu disburse ulang tidak diperlukan — hubungi support jika perlu backfill manual.",
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
