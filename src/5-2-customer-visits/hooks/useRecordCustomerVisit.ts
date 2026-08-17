import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { getLocalDateYmd } from '@/shared/lib/date/getLocalDateYmd';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CustomerVisitLookupKind, CustomerVisitMatchStatus } from '../lib/customerVisit.types';

export type RecordCustomerVisitInput = {
  lookupKind: CustomerVisitLookupKind;
  lookupRaw: string;
  lookupNormalized: string;
  matchStatus: CustomerVisitMatchStatus;
  leadId: string | null;
  notes?: string | null;
};

export type RecordCustomerVisitResult = {
  id: string;
  reused: boolean;
};

async function findCompletedMatchedToday(args: {
  organizationId: string;
  leadId: string;
  visitDate: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('customer_visits')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('lead_id', args.leadId)
    .eq('visit_date', args.visitDate)
    .eq('match_status', 'matched')
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export function useRecordCustomerVisit() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordCustomerVisitInput): Promise<RecordCustomerVisitResult> => {
      if (!organizationId) throw new Error('Organization ID is required');
      const visitDate = getLocalDateYmd();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (input.matchStatus === 'matched' && input.leadId) {
        const existingId = await findCompletedMatchedToday({
          organizationId,
          leadId: input.leadId,
          visitDate,
        });
        if (existingId) return { id: existingId, reused: true };
      }

      const { data, error } = await supabase
        .from('customer_visits')
        .insert({
          organization_id: organizationId,
          visit_date: visitDate,
          status: 'completed',
          lead_id: input.matchStatus === 'matched' ? input.leadId : null,
          lookup_kind: input.lookupKind,
          lookup_raw: input.lookupRaw.trim(),
          lookup_normalized: input.lookupNormalized,
          match_status: input.matchStatus,
          notes: input.notes?.trim() || null,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();

      if (error) {
        if (input.matchStatus === 'matched' && input.leadId && isUniqueViolation(error)) {
          const racedId = await findCompletedMatchedToday({
            organizationId,
            leadId: input.leadId,
            visitDate,
          });
          if (racedId) return { id: racedId, reused: true };
        }
        throw error;
      }
      if (!data?.id) throw new Error('customer_visit_insert_no_id');
      return { id: data.id, reused: false };
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['customer-visits', organizationId] });
      }
    },
  });
}
