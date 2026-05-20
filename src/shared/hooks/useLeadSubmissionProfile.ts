import { useQuery } from '@tanstack/react-query';
import {
  fetchLeadSubmissionForProfile,
  type LeadSubmissionProfileRow,
} from '@/shared/lib/leadSubmissionProfile';

export function useLeadSubmissionProfile(leadId: string | null, organizationId: string | null) {
  return useQuery({
    queryKey: ['lead-submission-profile', leadId, organizationId],
    queryFn: async (): Promise<LeadSubmissionProfileRow | null> => {
      if (!leadId || !organizationId) return null;
      if (leadId.startsWith('wa-') || leadId.startsWith('email-')) return null;
      return fetchLeadSubmissionForProfile(leadId, organizationId);
    },
    enabled: Boolean(leadId && organizationId && !leadId.startsWith('wa-') && !leadId.startsWith('email-')),
  });
}
