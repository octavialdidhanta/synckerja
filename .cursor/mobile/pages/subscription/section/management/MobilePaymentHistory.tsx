import { memo, useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/features/1-login/hooks/useCurrentOrg";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Badge } from "@/mobile/components/ui/badge";
import { Button } from "@/mobile/components/ui/button";
import { Separator } from "@/mobile/components/ui/separator";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { formatIDR } from "@/features/10-management/utils/subscriptionUtils";
import { format } from "date-fns";
import { addMonths, addYears } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { toast } from "sonner";
import { Download, History, Loader2, RefreshCw, Trash2, CreditCard } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/mobile/integrations/supabase/types";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { applyVariables } from "@/features/share/i18n/translations";
import { useMidtransPayment } from "@/features/10-Plans/hooks/useMidtransPayment";

type PaymentRecord = Tables<"payments"> & {
  subscription_plans: {
    id: string;
    name: string;
    base_price_per_member: number;
  } | null;
  notes?: string | null;
};

const statusBadgeVariant = (status: string, t: (key: string) => string) => {
  switch (status?.toLowerCase()) {
    case "settlement":
    case "success":
    case "paid":
      return { className: "bg-emerald-500/10 text-emerald-700", label: t("subscription.management.statusSuccess") };
    case "pending":
      return { className: "bg-amber-500/10 text-amber-700", label: t("subscription.management.statusPending") };
    case "failed":
    case "cancelled":
      return { className: "bg-red-500/10 text-red-700", label: t("subscription.management.statusFailed") };
    default:
      return { className: "bg-muted text-muted-foreground", label: status || t("subscription.management.statusUnknown") };
  }
};

const formatDateTime = (value: string) =>
  format(new Date(value), "dd MMM yyyy • HH:mm", { locale: localeID });

export const MobilePaymentHistory = memo(() => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { openSnapForPendingOrder, isLoading: isSnapLoading } = useMidtransPayment({
    onPaymentStatusChange: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["subscription-status", organizationId] });
    },
  });

  const cancelPendingPayment = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke("cancel-pending-payment", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      const res = data as { success?: boolean; error?: string; message?: string } | undefined;
      if (res && res.success !== true && res.error) {
        throw new Error(res.message ?? res.error);
      }
      return data;
    },
    onSuccess: () => {
      toast.success(t("subscription.management.pendingPayments.deleteSuccess", "Pembayaran pending dibatalkan."));
      queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? t("subscription.management.pendingPayments.deleteError", "Gagal membatalkan pembayaran."));
    },
  });

  const refreshPaymentStatus = useMutation({
    mutationFn: async (payment: PaymentRecord) => {
      const { data, error } = await supabase.functions.invoke("check-midtrans-payment-status", {
        body: { order_id: payment.order_id },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || "Failed to check payment status");
      }
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === "success") {
        toast.success(t("subscription.management.refreshSuccess", "Status pembayaran berhasil diperbarui."));
      } else {
        toast.info(t("subscription.management.refreshPending", "Status masih pending. Tunggu konfirmasi."));
      }
      queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["subscription-status", organizationId] });
    },
    onError: (error: Error) => {
      toast.error(t("subscription.management.refreshError", "Gagal memperbarui status."));
    },
  });

  const { data: payments = [], isLoading, isError, refetch } = useQuery<PaymentRecord[]>({
    queryKey: ["payment-history", organizationId],
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          *,
          subscription_plans (
            id,
            name,
            base_price_per_member
          )
        `,
        )
        .eq("organization_id", organizationId)
        .in("status", ["success", "settlement", "paid"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingPayments = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["payment-pending", organizationId],
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          *,
          subscription_plans (
            id,
            name,
            base_price_per_member
          )
        `,
        )
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Next Payment Date: early → next = scheduled_due + 1 month; on-time/late → next = payment_date + 1 month. Same as desktop.
  const nextPaymentDateByPaymentId = useMemo(() => {
    const sorted = [...payments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const nextMap = new Map<string, Date>();
    const periodStartMap = new Map<string, Date>();
    const periodEndMap = new Map<string, Date>();
    let prevNext: Date | null = null;
    for (const p of sorted) {
      const created = p.created_at ? new Date(p.created_at) : null;
      const cycle = p.billing_cycle === "yearly" ? 12 : 1;
      const addOne = (d: Date) => (cycle === 12 ? addYears(d, 1) : addMonths(d, 1));
      let next: Date | null = null;
      const startFromDb = p.subscription_start_date ? new Date(p.subscription_start_date) : null;
      const endFromDb = p.subscription_end_date ? new Date(p.subscription_end_date) : null;
      const useDb = endFromDb && startFromDb && created && startFromDb.getTime() <= created.getTime();
      if (useDb) {
        next = endFromDb;
        periodStartMap.set(p.id, startFromDb);
        periodEndMap.set(p.id, endFromDb);
      } else if (created) {
        if (prevNext && created.getTime() < prevNext.getTime()) {
          next = addOne(prevNext);
          periodStartMap.set(p.id, prevNext);
        } else {
          next = addOne(created);
          periodStartMap.set(p.id, created);
        }
        if (next) periodEndMap.set(p.id, next);
      }
      if (next) nextMap.set(p.id, next);
      prevNext = next;
    }
    return { nextMap, periodStartMap, periodEndMap };
  }, [payments]);

  const paymentsForDisplay = useMemo(
    () => [...payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [payments],
  );

  const handleDownloadReceipt = useCallback(
    async (
      payment: PaymentRecord,
      precomputed?: { nextPaymentDate: Date | null; periodStart: Date | null; periodEnd: Date | null },
    ) => {
      if (!organizationId) return;
      setDownloadingId(payment.id);
      try {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("company_name, email, address")
          .eq("id", organizationId)
          .single();

        const { data: subscriptionData } = await supabase
          .from("organization_subscriptions")
          .select("subscription_start_date, subscription_end_date, billing_cycle")
          .eq("last_payment_id", payment.id)
          .maybeSingle();

        const nextBillingDateStr = precomputed?.nextPaymentDate
          ? format(precomputed.nextPaymentDate, "dd MMMM yyyy", { locale: localeID })
          : (() => {
              const endFromDb = payment.subscription_end_date ?? subscriptionData?.subscription_end_date;
              if (endFromDb) return format(new Date(endFromDb), "dd MMMM yyyy", { locale: localeID });
              if (payment.created_at) {
                const d = new Date(payment.created_at);
                const end = payment.billing_cycle === "yearly" ? addYears(d, 1) : addMonths(d, 1);
                return format(end, "dd MMMM yyyy", { locale: localeID });
              }
              return "-";
            })();

        const periodStartDate = precomputed?.periodStart
          ? precomputed.periodStart
          : payment.subscription_start_date
            ? new Date(payment.subscription_start_date)
            : subscriptionData?.subscription_start_date
              ? new Date(subscriptionData.subscription_start_date)
              : payment.created_at
                ? new Date(payment.created_at)
                : null;
        const periodEndDate = precomputed?.periodEnd
          ? precomputed.periodEnd
          : payment.subscription_end_date
            ? new Date(payment.subscription_end_date)
            : subscriptionData?.subscription_end_date
              ? new Date(subscriptionData.subscription_end_date)
              : payment.created_at
                ? (payment.billing_cycle === "yearly"
                    ? addYears(new Date(payment.created_at), 1)
                    : addMonths(new Date(payment.created_at), 1))
                : null;
        const periodStart = periodStartDate ? format(periodStartDate, "MMM dd, yyyy", { locale: localeID }) : "-";
        const periodEnd = periodEndDate ? format(periodEndDate, "MMM dd, yyyy", { locale: localeID }) : "-";

        const doc = new jsPDF();
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("ProfitLoop Invoice", margin, 25);

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("ProfitLoop App", margin, 35);
        doc.text("Subscription Management System", margin, 41);
        doc.text("support@profitloop.app", margin, 47);
        doc.text("https://app.profitloop.id/", margin, 53);

        const infoX = pageWidth - margin - 80;
        doc.setFont("helvetica", "bold");
        doc.text("Invoice Detail", infoX, 35);
        doc.setFont("helvetica", "normal");
        doc.text(`Invoice #: ${payment.order_id}`, infoX, 41);
        doc.text(`Tanggal: ${payment.created_at ? formatDateTime(payment.created_at) : "-"}`, infoX, 47);
        doc.text(`Status: ${payment.status}`, infoX, 53);
        doc.text(`Next Billing Date: ${nextBillingDateStr}`, infoX, 59);

        doc.text("Tagihan untuk:", margin, 70);
        doc.setFont("helvetica", "bold");
        doc.text(orgData?.company_name || t("subscription.management.invoiceCompanyFallback"), margin, 76);
        doc.setFont("helvetica", "normal");
        if (orgData?.email) doc.text(orgData.email, margin, 82);
        if (orgData?.address) doc.text(orgData.address, margin, 88);

        doc.text("Ringkasan Pembayaran", margin, 105);
        const planName = payment.subscription_plans?.name || "Subscription";
        const billingCycle = payment.billing_cycle || "monthly";
        const description = `${planName} (${billingCycle})\nPeriod: ${periodStart} to ${periodEnd}`;
        autoTable(doc, {
          startY: 110,
          head: [["Deskripsi", "Jumlah"]],
          body: [[description, formatIDR(payment.amount)]],
          theme: "grid",
          styles: { fontSize: 10 },
          headStyles: { fillColor: [59, 130, 246] },
        });

        const finalY = (doc as any).lastAutoTable.finalY || 130;
        doc.setFont("helvetica", "bold");
        doc.text(`Total dibayar: ${formatIDR(payment.amount)}`, margin, finalY + 15);

        doc.save(`invoice-${payment.order_id}.pdf`);
      } catch {
        toast.error(t("subscription.management.downloadReceiptError"));
      } finally {
        setDownloadingId(null);
      }
    },
    [organizationId, t],
  );

  if (isLoading) {
    return (
      <Card className="border border-border">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-base text-foreground">{t("subscription.management.paymentHistory")}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            {t("subscription.management.loadingPayments")}
          </CardDescription>
        </CardHeader>
        <CardContent className="py-3 px-3 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={`payment-skeleton-${i}`} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-destructive/40 bg-destructive/5">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-base text-destructive">{t("subscription.management.errorLoadPayments")}</CardTitle>
          <CardDescription className="text-xs text-destructive mt-0.5">
            {t("subscription.management.errorLoadDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            {t("subscription.management.tryAgain")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-base text-foreground">{t("subscription.management.paymentHistory")}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-0.5">
          {t("subscription.management.paymentHistoryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-0 px-3 pb-3">
        {pendingPayments.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
            <p className="text-xs font-medium text-amber-800">
              {applyVariables(t("subscription.management.pendingPayments.title", "You have {{count}} pending payment(s)."), { count: String(pendingPayments.length) })}
            </p>
            <div className="mt-2 space-y-2">
              {pendingPayments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/60 p-2 text-xs">
                  <span className="font-mono text-amber-900">{payment.order_id}</span>
                  <span className="font-semibold text-amber-900">{formatIDR(payment.amount)}</span>
                  <span className="text-amber-700">{payment.created_at ? formatDateTime(payment.created_at) : "N/A"}</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => openSnapForPendingOrder(payment.order_id)}
                      disabled={isSnapLoading}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {t("subscription.management.pendingPayments.pay", "Bayar")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={() => cancelPendingPayment.mutate(payment.order_id)}
                      disabled={cancelPendingPayment.isPending}
                    >
                      {cancelPendingPayment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {t("subscription.management.pendingPayments.delete", "Hapus")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => refreshPaymentStatus.mutate(payment)}
                      disabled={refreshPaymentStatus.isPending}
                    >
                      {refreshPaymentStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {t("subscription.management.pendingPayments.refreshStatus", "Refresh status")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <History className="h-8 w-8 text-muted-foreground/60" />
            <p>{t("subscription.management.noPaymentsHint")}</p>
          </div>
        ) : (
        <>
        {paymentsForDisplay.map((payment) => {
          const badge = statusBadgeVariant(payment.status, t);
          const nextDate = nextPaymentDateByPaymentId.nextMap.get(payment.id);
          return (
            <div
              key={payment.id}
              className="space-y-2 rounded-2xl border border-border bg-muted/30 p-2.5 text-sm text-muted-foreground"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {payment.subscription_plans?.name || t("subscription.management.planFallback")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatIDR(payment.amount)}</p>
                </div>
                <Badge className={badge.className}>{badge.label}</Badge>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span>{t("subscription.management.transactionId")}</span>
                  <span className="font-medium text-foreground">{payment.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("subscription.management.date")}</span>
                  <span className="font-medium text-foreground">{formatDateTime(payment.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("subscription.management.billingCycle")}</span>
                  <span className="font-medium text-foreground capitalize">{payment.billing_cycle}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("subscription.management.nextPaymentDate", "Next Payment Date")}</span>
                  <span className="font-medium text-foreground">
                    {nextDate ? format(nextDate, "dd MMM yyyy", { locale: localeID }) : "-"}
                  </span>
                </div>
              </div>
              {payment.notes && (
                <div className="rounded-lg border border-border bg-background/60 p-1.5 text-[11px] text-muted-foreground">
                  {t("subscription.management.note")}: {payment.notes}
                </div>
              )}
              <Separator className="my-1.5" />
              <div className="flex gap-2">
                {payment.status?.toLowerCase() === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center gap-2 text-xs"
                    onClick={() => refreshPaymentStatus.mutate(payment)}
                    disabled={refreshPaymentStatus.isPending}
                  >
                    {refreshPaymentStatus.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {t("subscription.management.refreshStatus", "Perbarui Status")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-center gap-2 text-xs"
                  onClick={() =>
                    handleDownloadReceipt(payment, {
                      nextPaymentDate: nextPaymentDateByPaymentId.nextMap.get(payment.id) ?? null,
                      periodStart: nextPaymentDateByPaymentId.periodStartMap.get(payment.id) ?? null,
                      periodEnd: nextPaymentDateByPaymentId.periodEndMap.get(payment.id) ?? null,
                    })
                  }
                  disabled={downloadingId === payment.id}
                >
                  {downloadingId === payment.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloadingId === payment.id ? t("subscription.management.downloadingReceipt") : t("subscription.management.downloadReceipt")}
                </Button>
              </div>
            </div>
          );
        })}
        </>
        )}
      </CardContent>
    </Card>
  );
});

MobilePaymentHistory.displayName = "MobilePaymentHistory";

