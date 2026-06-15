import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type BrickPaymentRequest = {
  id: string;
  organization_id: string;
  sales_activity_payment_id: string;
  reference_id: string;
  brick_va_id: string | null;
  brick_payment_id: string | null;
  bank_short_code: string;
  account_no: string | null;
  expected_amount: number;
  status: 'pending' | 'paid' | 'completed' | 'expired' | 'failed';
  paid_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useBrickPaymentRequest(
  organizationId: string | null | undefined,
  salesActivityPaymentId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['brick-payment-request', organizationId, salesActivityPaymentId],
    enabled: Boolean(organizationId && salesActivityPaymentId),
    queryFn: async () => {
      if (!organizationId || !salesActivityPaymentId) return null;

      const { data, error } = await supabase
        .from('brick_payment_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('sales_activity_payment_id', salesActivityPaymentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as BrickPaymentRequest | null) ?? null;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'paid') return 15000;
      return false;
    },
  });
}
