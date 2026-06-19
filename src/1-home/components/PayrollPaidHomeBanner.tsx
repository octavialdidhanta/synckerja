import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Banknote, Sparkles, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { usePayrollPaidAnnouncements } from "@/1-home/hooks/usePayrollPaidAnnouncements";
import { useReportHomeSectionStatus } from "@/1-home/context/HomePageLoadContext";

export function PayrollPaidHomeBanner() {
  const { t } = useTranslation();
  const { announcements, isLoading, isError, dismiss } = usePayrollPaidAnnouncements();

  useReportHomeSectionStatus("payrollBanner", isLoading, isError ? new Error("payroll banner") : null);

  if (isLoading || announcements.length === 0) {
    return null;
  }

  const item = announcements[0];
  const bankLabel = item.bank_name?.trim() || t("payroll.paidAnnouncement.bankFallback", "Bank");
  const last4 = item.account_last4?.trim() || "----";

  return (
    <Card
      role="region"
      aria-label={t("payroll.paidAnnouncement.ariaLabel", "Pengumuman gaji ditransfer")}
      className="flex-shrink-0 overflow-hidden border-amber-400/40 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md"
    >
      <CardContent className="relative p-4 pr-12">
        <button
          type="button"
          className="absolute top-3 right-3 rounded-md p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
          aria-label={t("common.dismiss", "Tutup")}
          onClick={() => void dismiss(item.id)}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300/25 ring-1 ring-amber-200/50">
            <Banknote className="h-5 w-5 text-amber-100" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold tracking-tight">
              {t("payroll.paidAnnouncement.title", "Gaji sudah ditransfer")}
            </p>
            <p className="text-sm leading-snug text-emerald-50">
              {t("payroll.paidAnnouncement.body", "Gaji {{period}} telah ditransfer ke rekening {{bank}} •••{{last4}}", {
                period: item.period_label,
                bank: bankLabel,
                last4,
              })}
            </p>
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-emerald-100/95">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" aria-hidden />
              <span>{t(item.finance_tip_key, "")}</span>
            </p>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="h-8 border-0 bg-white/15 text-white hover:bg-white/25"
            >
              <Link to="/profile/payslips">
                {t("payroll.paidAnnouncement.ctaPayslip", "Lihat slip gaji")}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
