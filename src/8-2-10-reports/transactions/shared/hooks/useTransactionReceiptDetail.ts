import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosReceiptTotalsLine } from "@/8-2-6-receipt/lib/posReceipt.types";
import type { TransactionReceiptDetail } from "../lib/mapTransactionReceipt";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function resolveStaffName(userId: string | null, orgId: string): Promise<string | null> {
  if (!userId) return null;
  const [empRes, profRes] = await Promise.all([
    supabase
      .from("employees")
      .select("full_name")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
  ]);
  const name =
    empRes.data?.full_name?.trim() || profRes.data?.full_name?.trim() || null;
  return name;
}

export function useTransactionReceiptDetail(activityId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ["transaction-receipt-detail", organizationId, activityId],
    enabled: Boolean(organizationId && activityId),
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TransactionReceiptDetail | null> => {
      if (!organizationId || !activityId) return null;

      const [
        activityRes,
        itemsRes,
        modifiersRes,
        discountsRes,
        taxesRes,
        gratuitiesRes,
      ] = await Promise.all([
        supabase
          .from("sales_activities")
          .select(
            "id, client_name, client_phone, date, created_at, total_amount, total_paid_amount, checkout_subtotal, checkout_tax_amount, checkout_gratuity_amount, checkout_discount_amount, payment_method, payment_reference, cash_tendered, table_number, pos_outlet_id, catalog_sales_type_id, served_by_user_id, created_by",
          )
          .eq("id", activityId)
          .eq("organization_id", organizationId)
          .maybeSingle(),
        supabase
          .from("sales_activity_items")
          .select("id, service_name, sub_service_name, quantity, unit_price, total_price")
          .eq("sales_activity_id", activityId)
          .eq("organization_id", organizationId)
          .order("created_at"),
        supabase
          .from("sales_activity_item_modifiers")
          .select("sales_activity_item_id, option_name, extra_price, quantity")
          .eq("sales_activity_id", activityId)
          .eq("organization_id", organizationId),
        supabase
          .from("sales_activity_line_discounts")
          .select("sales_activity_item_id, discount_name, amount_rp")
          .eq("sales_activity_id", activityId)
          .eq("organization_id", organizationId),
        supabase
          .from("sales_activity_checkout_taxes")
          .select("tax_name, amount_rp, amount_percent")
          .eq("sales_activity_id", activityId)
          .eq("organization_id", organizationId),
        supabase
          .from("sales_activity_checkout_gratuities")
          .select("gratuity_name, amount_rp, amount_percent")
          .eq("sales_activity_id", activityId)
          .eq("organization_id", organizationId),
      ]);

      for (const res of [
        activityRes,
        itemsRes,
        modifiersRes,
        discountsRes,
        taxesRes,
        gratuitiesRes,
      ]) {
        if (res.error) throw res.error;
      }
      if (!activityRes.data) return null;

      const sale = activityRes.data;
      const [servedByName, collectedByName] = await Promise.all([
        resolveStaffName(sale.served_by_user_id, organizationId),
        resolveStaffName(sale.created_by, organizationId),
      ]);

      const taxLines: PosReceiptTotalsLine[] = (taxesRes.data ?? []).map((row) => ({
        name: String(row.tax_name ?? "Tax"),
        amount: num(row.amount_rp),
        amount_percent: row.amount_percent != null ? num(row.amount_percent) : undefined,
      }));

      const gratuityLines: PosReceiptTotalsLine[] = (gratuitiesRes.data ?? []).map((row) => ({
        name: String(row.gratuity_name ?? "Gratuity"),
        amount: num(row.amount_rp),
        amount_percent: row.amount_percent != null ? num(row.amount_percent) : undefined,
      }));

      return {
        salesActivityId: String(sale.id),
        posOutletId: sale.pos_outlet_id != null ? String(sale.pos_outlet_id) : null,
        clientName: String(sale.client_name ?? "—"),
        clientPhone: sale.client_phone != null ? String(sale.client_phone) : null,
        date: sale.date != null ? String(sale.date) : null,
        createdAt: sale.created_at != null ? String(sale.created_at) : null,
        totalAmount: num(sale.total_amount),
        totalPaidAmount: sale.total_paid_amount != null ? num(sale.total_paid_amount) : null,
        checkoutSubtotal: sale.checkout_subtotal != null ? num(sale.checkout_subtotal) : null,
        checkoutTaxAmount: sale.checkout_tax_amount != null ? num(sale.checkout_tax_amount) : null,
        checkoutGratuityAmount:
          sale.checkout_gratuity_amount != null ? num(sale.checkout_gratuity_amount) : null,
        checkoutDiscountAmount:
          sale.checkout_discount_amount != null ? num(sale.checkout_discount_amount) : null,
        checkoutDiscountLabel: null,
        paymentMethod: sale.payment_method != null ? String(sale.payment_method) : null,
        paymentReference: sale.payment_reference != null ? String(sale.payment_reference) : null,
        cashTendered: sale.cash_tendered != null ? num(sale.cash_tendered) : null,
        tableNumber: sale.table_number != null ? String(sale.table_number) : null,
        catalogSalesTypeId:
          sale.catalog_sales_type_id != null ? String(sale.catalog_sales_type_id) : null,
        servedByName,
        collectedByName,
        items: (itemsRes.data ?? []).map((item) => ({
          id: String(item.id),
          serviceName: String(item.service_name ?? ""),
          subServiceName: item.sub_service_name != null ? String(item.sub_service_name) : null,
          quantity: num(item.quantity),
          unitPrice: num(item.unit_price),
          totalPrice: num(item.total_price),
        })),
        modifiers: (modifiersRes.data ?? []).map((row) => ({
          salesActivityItemId:
            row.sales_activity_item_id != null ? String(row.sales_activity_item_id) : null,
          optionName: String(row.option_name ?? ""),
          extraPrice: num(row.extra_price),
          quantity: num(row.quantity),
        })),
        lineDiscounts: (discountsRes.data ?? []).map((row) => ({
          salesActivityItemId:
            row.sales_activity_item_id != null ? String(row.sales_activity_item_id) : null,
          discountName: String(row.discount_name ?? "Discount"),
          amountRp: num(row.amount_rp),
        })),
        taxLines,
        gratuityLines,
      };
    },
  });
}
