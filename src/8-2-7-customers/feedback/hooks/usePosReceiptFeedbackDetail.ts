import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import type { StoreCheckoutReceiptItem } from '@/8-2-6-receipt/lib/mapStoreCheckoutReceipt';

export type FeedbackReceiptDetail = {
  salesActivityId: string;
  posOutletId: string | null;
  clientName: string;
  clientPhone: string | null;
  date: string | null;
  createdAt: string | null;
  totalAmount: number;
  checkoutSubtotal: number | null;
  checkoutTaxAmount: number | null;
  checkoutGratuityAmount: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  cashTendered: number | null;
  tableNumber: string | null;
  catalogSalesTypeId: string | null;
  items: StoreCheckoutReceiptItem[];
};

export function usePosReceiptFeedbackDetail(salesActivityId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['pos-receipt-feedback-detail', organizationId, salesActivityId],
    enabled: Boolean(organizationId && salesActivityId),
    queryFn: async (): Promise<FeedbackReceiptDetail | null> => {
      if (!organizationId || !salesActivityId) return null;

      const [activityRes, itemsRes] = await Promise.all([
        supabase
          .from('sales_activities')
          .select(
            'id, client_name, client_phone, date, created_at, total_amount, checkout_subtotal, checkout_tax_amount, checkout_gratuity_amount, payment_method, payment_reference, cash_tendered, table_number, pos_outlet_id, catalog_sales_type_id',
          )
          .eq('id', salesActivityId)
          .eq('organization_id', organizationId)
          .maybeSingle(),
        supabase
          .from('sales_activity_items')
          .select('id, service_name, sub_service_name, quantity, unit_price, total_price')
          .eq('sales_activity_id', salesActivityId)
          .eq('organization_id', organizationId),
      ]);

      if (activityRes.error) throw activityRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (!activityRes.data) return null;

      const sale = activityRes.data;
      return {
        salesActivityId: String(sale.id),
        posOutletId: sale.pos_outlet_id != null ? String(sale.pos_outlet_id) : null,
        clientName: String(sale.client_name ?? '—'),
        clientPhone: sale.client_phone != null ? String(sale.client_phone) : null,
        date: sale.date != null ? String(sale.date) : null,
        createdAt: sale.created_at != null ? String(sale.created_at) : null,
        totalAmount: Number(sale.total_amount ?? 0),
        checkoutSubtotal: sale.checkout_subtotal != null ? Number(sale.checkout_subtotal) : null,
        checkoutTaxAmount: sale.checkout_tax_amount != null ? Number(sale.checkout_tax_amount) : null,
        checkoutGratuityAmount:
          sale.checkout_gratuity_amount != null ? Number(sale.checkout_gratuity_amount) : null,
        paymentMethod: sale.payment_method != null ? String(sale.payment_method) : null,
        paymentReference: sale.payment_reference != null ? String(sale.payment_reference) : null,
        cashTendered: sale.cash_tendered != null ? Number(sale.cash_tendered) : null,
        tableNumber: sale.table_number != null ? String(sale.table_number) : null,
        catalogSalesTypeId:
          sale.catalog_sales_type_id != null ? String(sale.catalog_sales_type_id) : null,
        items: (itemsRes.data ?? []).map((item) => ({
          id: String(item.id),
          service_name: String(item.service_name ?? ''),
          sub_service_name: item.sub_service_name != null ? String(item.sub_service_name) : null,
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          total_price: Number(item.total_price ?? 0),
        })),
      };
    },
  });
}
