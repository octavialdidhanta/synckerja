import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface LeavePolicyData {
  id: string;
  organization_id: string;
  policy_name: string;
  policy_type: string;
  is_enabled: boolean;
  probation_months: number;
  auto_grant_after_probation: boolean;
  annual_leave_days: number;
  leave_grant_after_months: number;
  effective_date: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  leave_strategy: string;
  carry_over_limit: number;
  carry_over_expiry_months: number;
  max_leave_balance: number;
}

export const useLeavePolicy = (organizationId: string) => {
  return useQuery({
    queryKey: ['leave-policy', organizationId],
    queryFn: async () => {
      console.log('🔍 Fetching leave policy for organization:', organizationId);
      
      const { data, error } = await supabase
        .from('leave_policies')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_enabled', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching leave policy:', error);
        throw error;
      }

      console.log('✅ Leave policy fetched:', data);
      return data as LeavePolicyData | null;
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  });
};
