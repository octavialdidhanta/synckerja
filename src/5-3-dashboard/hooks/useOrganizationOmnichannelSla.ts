import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

/** Legacy shape: org “baseline” minutes (Default policy if present, else legacy row). */
export type OrganizationOmnichannelSlaRow = {
  organization_id: string;
  first_response_sla_minutes: number;
  resolution_sla_minutes: number;
  updated_at: string;
  updated_by: string | null;
};

export function useOrganizationOmnichannelSla(organizationId: string | null | undefined) {
  const qid = organizationId ?? null;
  return useQuery({
    queryKey: ['organization-omnichannel-sla', qid],
    enabled: !!qid,
    queryFn: async (): Promise<OrganizationOmnichannelSlaRow | null> => {
      if (!qid) return null;
      const { data: def, error: dErr } = await supabase
        .from('organization_sla_policies')
        .select('organization_id, first_response_sla_minutes, resolution_sla_minutes, updated_at, updated_by')
        .eq('organization_id', qid)
        .eq('name', 'Default')
        .eq('priority', 10000)
        .maybeSingle();
      if (dErr) throw dErr;
      let row = def;
      if (!row) {
        const { data: policies, error } = await supabase
          .from('organization_sla_policies')
          .select('organization_id, first_response_sla_minutes, resolution_sla_minutes, updated_at, updated_by')
          .eq('organization_id', qid)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1);
        if (error) throw error;
        row = Array.isArray(policies) ? policies[0] : null;
      }
      if (row) {
        return {
          organization_id: row.organization_id as string,
          first_response_sla_minutes: row.first_response_sla_minutes as number,
          resolution_sla_minutes: row.resolution_sla_minutes as number,
          updated_at: row.updated_at as string,
          updated_by: (row.updated_by as string | null) ?? null,
        };
      }
      const { data: legacy, error: lErr } = await supabase
        .from('organization_omnichannel_sla')
        .select('organization_id, first_response_sla_minutes, resolution_sla_minutes, updated_at, updated_by')
        .eq('organization_id', qid)
        .maybeSingle();
      if (lErr) throw lErr;
      return legacy as OrganizationOmnichannelSlaRow | null;
    },
  });
}

export function useUpdateOrganizationOmnichannelSla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      first_response_sla_minutes: number;
      resolution_sla_minutes: number;
      userId: string;
    }) => {
      const { organizationId, first_response_sla_minutes, resolution_sla_minutes, userId } = payload;
      const now = new Date().toISOString();
      const { data: def } = await supabase
        .from('organization_sla_policies')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', 'Default')
        .eq('priority', 10000)
        .maybeSingle();
      let policyId = def?.id as string | undefined;
      if (!policyId) {
        const { data: first } = await supabase
          .from('organization_sla_policies')
          .select('id')
          .eq('organization_id', organizationId)
          .order('priority', { ascending: true })
          .limit(1)
          .maybeSingle();
        policyId = first?.id as string | undefined;
      }
      if (policyId) {
        const { error: pErr } = await supabase
          .from('organization_sla_policies')
          .update({
            first_response_sla_minutes,
            resolution_sla_minutes,
            updated_by: userId,
            updated_at: now,
          })
          .eq('id', policyId);
        if (pErr) throw pErr;
      }
      const { data, error } = await supabase
        .from('organization_omnichannel_sla')
        .upsert(
          {
            organization_id: organizationId,
            first_response_sla_minutes,
            resolution_sla_minutes,
            updated_by: userId,
            updated_at: now,
          },
          { onConflict: 'organization_id' },
        )
        .select('organization_id, first_response_sla_minutes, resolution_sla_minutes, updated_at, updated_by')
        .single();
      if (error) throw error;
      return data as OrganizationOmnichannelSlaRow;
    },
    onSuccess: (_, v) => {
      void queryClient.invalidateQueries({ queryKey: ['organization-omnichannel-sla', v.organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['organization-sla-policies', v.organizationId] });
      void queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', v.organizationId] });
    },
  });
}
