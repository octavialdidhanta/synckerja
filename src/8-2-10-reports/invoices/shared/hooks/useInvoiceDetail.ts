import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  computeInvoiceDisplayStatus,
  computeOverdueDays,
} from "../lib/computeInvoiceDisplayStatus";
import { formatInvoiceNumberFromActivityId } from "../lib/formatInvoiceNumber";
import type { InvoiceDetail } from "../lib/invoicesTypes";

export function useInvoiceDetail(activityId: string | null) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  return useQuery({
    queryKey: ["pos-invoice-detail", organizationId, activityId],
    enabled: Boolean(organizationId && activityId && !orgLoading),
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<InvoiceDetail | null> => {
      const { data: activity, error: actErr } = await supabase
        .from("sales_activities")
        .select(
          "id, organization_id, client_name, client_phone, client_email, created_at, date, activity_type, pos_outlet_id, total_amount, total_paid_amount, payment_status, description, invoice_number, invoice_due_date, invoice_issued_at, invoice_cancelled_at, invoice_cancel_reason",
        )
        .eq("id", activityId!)
        .maybeSingle();
      if (actErr) throw actErr;
      if (!activity) return null;

      const [{ data: items, error: itemsErr }, { data: payments, error: payErr }] =
        await Promise.all([
          supabase
            .from("sales_activity_items")
            .select("id, service_name, sub_service_name, quantity, unit_price, total_price")
            .eq("sales_activity_id", activityId!)
            .order("created_at", { ascending: true }),
          supabase
            .from("sales_activity_payments")
            .select(
              "id, payment_amount, payment_date, payment_method, payment_type, payment_sequence, notes",
            )
            .eq("sales_activity_id", activityId!)
            .order("payment_sequence", { ascending: true }),
        ]);
      if (itemsErr) throw itemsErr;
      if (payErr) throw payErr;

      const totalAmount = Number(activity.total_amount ?? 0);
      const totalPaidAmount = Number(activity.total_paid_amount ?? 0);
      const invoiceDueDate = activity.invoice_due_date ?? null;
      const invoiceCancelledAt = activity.invoice_cancelled_at ?? null;
      const displayStatus = computeInvoiceDisplayStatus({
        invoiceCancelledAt,
        invoiceDueDate,
        paymentStatus: activity.payment_status,
        totalAmount,
        totalPaidAmount,
      });

      return {
        activityId: activity.id,
        invoiceNumber:
          activity.invoice_number ?? formatInvoiceNumberFromActivityId(activity.id),
        clientName: activity.client_name ?? "—",
        clientPhone: activity.client_phone ?? null,
        clientEmail: activity.client_email ?? null,
        createdAt: activity.created_at ?? null,
        invoiceDueDate,
        invoiceIssuedAt: activity.invoice_issued_at ?? activity.created_at ?? null,
        invoiceCancelledAt,
        invoiceCancelReason: activity.invoice_cancel_reason ?? null,
        posOutletId: activity.pos_outlet_id ?? null,
        activityType: activity.activity_type ?? null,
        displayStatus,
        overdueDays: computeOverdueDays(invoiceDueDate, invoiceCancelledAt),
        totalAmount,
        totalPaidAmount,
        amountDue: Math.max(totalAmount - totalPaidAmount, 0),
        description: activity.description ?? null,
        items: (items ?? []).map((item) => ({
          id: item.id,
          serviceName: item.service_name ?? "Item",
          subServiceName: item.sub_service_name ?? null,
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unit_price ?? 0),
          totalPrice: Number(item.total_price ?? 0),
        })),
        payments: (payments ?? []).map((p) => ({
          id: p.id,
          paymentAmount: Number(p.payment_amount ?? 0),
          paymentDate: p.payment_date ?? "",
          paymentMethod: p.payment_method ?? null,
          paymentType: p.payment_type ?? null,
          paymentSequence: p.payment_sequence ?? null,
          notes: p.notes ?? null,
        })),
      };
    },
  });
}
