import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CustomerVisitEnrollmentRow, CustomerVisitLeadCandidate } from '../lib/matchCustomerVisitParty';

export type CustomerVisitDirectory = {
  leads: CustomerVisitLeadCandidate[];
  enrollments: CustomerVisitEnrollmentRow[];
};

export function useCustomerVisitDirectory() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['customer-visit-directory', organizationId],
    queryFn: async (): Promise<CustomerVisitDirectory> => {
      if (!organizationId) return { leads: [], enrollments: [] };

      const [leadsRes, enrollmentsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, client, phone_number, ticket_id, source')
          .eq('organization_id', organizationId),
        supabase
          .from('lead_magnet_enrollments')
          .select('lead_id, participant_username')
          .eq('organization_id', organizationId)
          .not('lead_id', 'is', null),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;

      return {
        leads: (leadsRes.data ?? []) as CustomerVisitLeadCandidate[],
        enrollments: (enrollmentsRes.data ?? []) as CustomerVisitEnrollmentRow[],
      };
    },
    enabled: !!organizationId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
