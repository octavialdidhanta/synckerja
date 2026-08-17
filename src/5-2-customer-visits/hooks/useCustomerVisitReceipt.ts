import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type CustomerVisitReceiptItem = {
  id: string;
  service_name: string;
  sub_service_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export function useCustomerVisitReceipt(salesActivityId: string | null) {
  return useQuery({
    queryKey: ['customer-visit-receipt', salesActivityId],
    queryFn: async (): Promise<CustomerVisitReceiptItem[]> => {
      if (!salesActivityId) return [];
      const { data, error } = await supabase
        .from('sales_activity_items')
        .select('id, service_name, sub_service_name, quantity, unit_price, total_price')
        .eq('sales_activity_id', salesActivityId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as CustomerVisitReceiptItem[];
    },
    enabled: Boolean(salesActivityId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
