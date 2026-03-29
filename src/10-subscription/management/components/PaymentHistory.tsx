import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CreditCard, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useMidtransPayment } from "@/10-subscription/hooks/useMidtransPayment";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

export function PaymentHistory() {
  const { t } = useTranslation();
  const { organizationId } = useActiveOrganization();
  const queryClient = useQueryClient();

  const { openSnapForPendingOrder, openingPendingOrderId } = useMidtransPayment({
    onPaymentStatusChange: () => {
      if (!organizationId) return;
      queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
    },
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payment-history", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select(`*, subscription_plans ( id, name, base_price_per_member )`)
        .eq("organization_id", organizationId)
        .in("status", ["success", "settlement", "paid"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ["payment-pending", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select(`*, subscription_plans ( id, name )`)
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const refreshMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke("check-midtrans-payment-status", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t("subscription.management.payment.refreshed"));
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["payment-history", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
      }
    },
    onError: () => toast.error(t("subscription.management.payment.refreshFailed")),
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke("cancel-pending-payment", {
        body: { order_id: orderId },
      });
      if (error) throw error;
      if (data && (data as { success?: boolean }).success !== true) {
        throw new Error((data as { message?: string }).message || "Cancel failed");
      }
    },
    onSuccess: () => {
      toast.success(t("subscription.management.payment.cancelled"));
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["payment-pending", organizationId] });
      }
    },
    onError: (e: Error) => toast.error(e.message || t("subscription.management.payment.cancelFailed")),
  });

  const statusBadge = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (["success", "settlement", "paid"].includes(s))
      return <Badge className="bg-brand-blue text-brand-white">{t("subscription.management.payment.status.success")}</Badge>;
    if (s === "pending") return <Badge variant="secondary">{t("subscription.management.payment.status.pending")}</Badge>;
    return <Badge variant="destructive">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {pendingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("subscription.management.pending.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(pendingPayments as Record<string, unknown>[]).map((p) => {
              const orderId = String(p.order_id);
              const isOpeningThisPay = openingPendingOrderId === orderId;
              /* Hanya baris ini yang disabled + spinner; baris lain tetap aktif (klik saat proses diabaikan di hook). */
              const payDisabled = isOpeningThisPay;
              const isRefreshingThis =
                refreshMutation.isPending && refreshMutation.variables === orderId;
              const isCancellingThis =
                cancelMutation.isPending && cancelMutation.variables === orderId;

              return (
                <div
                  key={String(p.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="text-sm">
                    <div className="font-medium">{orderId}</div>
                    <div className="text-muted-foreground">{formatIDR(Number(p.amount) || 0)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={payDisabled}
                      onClick={() => void openSnapForPendingOrder(orderId)}
                    >
                      {isOpeningThisPay ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-1 h-4 w-4" />
                      )}
                      {t("subscription.management.pending.pay")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isRefreshingThis}
                      onClick={() => refreshMutation.mutate(orderId)}
                    >
                      <RefreshCw
                        className={`mr-1 h-4 w-4 ${isRefreshingThis ? "animate-spin" : ""}`}
                      />
                      {t("subscription.management.pending.refresh")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isCancellingThis}
                      onClick={() => cancelMutation.mutate(orderId)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {t("subscription.management.pending.cancel")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("subscription.management.history.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("subscription.management.history.loading")}</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("subscription.management.history.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("subscription.management.history.order")}</TableHead>
                  <TableHead>{t("subscription.management.history.amount")}</TableHead>
                  <TableHead>{t("subscription.management.history.status")}</TableHead>
                  <TableHead>{t("subscription.management.history.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments as Record<string, unknown>[]).map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell className="font-mono text-xs">{String(p.order_id)}</TableCell>
                    <TableCell>{formatIDR(Number(p.amount) || 0)}</TableCell>
                    <TableCell>{statusBadge(String(p.status))}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.created_at ? new Date(String(p.created_at)).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
