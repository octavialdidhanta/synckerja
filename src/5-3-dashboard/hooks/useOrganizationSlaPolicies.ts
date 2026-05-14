import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type SlaPolicyConditionRow = {
  id: string;
  policy_id: string;
  field: string;
  operator: string;
  value: string;
  created_at: string;
};

export type OrganizationSlaPolicyRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  priority: number;
  first_response_sla_minutes: number;
  resolution_sla_minutes: number;
  inter_reply_sla_minutes: number | null;
  operational_hours_profile: '24x7' | 'business_hours';
  work_schedule_id: string | null;
  created_at: string;
  updated_at: string;
  organization_sla_policy_conditions?: SlaPolicyConditionRow[] | null;
};

export type OrganizationSlaWorkScheduleRow = {
  id: string;
  organization_id: string;
  timezone: string;
  weekly_rules: unknown;
  created_at: string;
  updated_at: string;
};

const policiesKey = (orgId: string) => ['organization-sla-policies', orgId] as const;
const scheduleKey = (orgId: string) => ['organization-sla-work-schedule', orgId] as const;

export function useOrganizationSlaPolicies(organizationId: string | null | undefined) {
  const orgId = organizationId ?? null;
  return useQuery({
    queryKey: policiesKey(orgId ?? ''),
    enabled: !!orgId,
    queryFn: async (): Promise<OrganizationSlaPolicyRow[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('organization_sla_policies')
        .select('*, organization_sla_policy_conditions(*)')
        .eq('organization_id', orgId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrganizationSlaPolicyRow[];
    },
  });
}

export function useOrganizationSlaWorkSchedule(organizationId: string | null | undefined) {
  const orgId = organizationId ?? null;
  return useQuery({
    queryKey: scheduleKey(orgId ?? ''),
    enabled: !!orgId,
    queryFn: async (): Promise<OrganizationSlaWorkScheduleRow | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organization_sla_work_schedules')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return data as OrganizationSlaWorkScheduleRow | null;
    },
  });
}

function invalidateSlaQueries(queryClient: ReturnType<typeof useQueryClient>, organizationId: string) {
  void queryClient.invalidateQueries({ queryKey: policiesKey(organizationId) });
  void queryClient.invalidateQueries({ queryKey: scheduleKey(organizationId) });
  void queryClient.invalidateQueries({ queryKey: ['crm-first-response-per-room', organizationId] });
  void queryClient.invalidateQueries({ queryKey: ['organization-omnichannel-sla', organizationId] });
}

export type CreateSlaPolicyInput = {
  organizationId: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  priority: number;
  first_response_sla_minutes: number;
  resolution_sla_minutes: number;
  inter_reply_sla_minutes: number | null;
  operational_hours_profile: '24x7' | 'business_hours';
  work_schedule_id: string | null;
  conditions: Array<{ field: 'channel'; operator: 'eq'; value: string }>;
  userId: string;
};

export function useCreateOrganizationSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSlaPolicyInput) => {
      const { data: policy, error: pErr } = await supabase
        .from('organization_sla_policies')
        .insert({
          organization_id: input.organizationId,
          name: input.name.trim().slice(0, 120),
          description: (input.description ?? '').trim().slice(0, 500),
          status: input.status,
          priority: input.priority,
          first_response_sla_minutes: input.first_response_sla_minutes,
          resolution_sla_minutes: input.resolution_sla_minutes,
          inter_reply_sla_minutes: input.inter_reply_sla_minutes,
          operational_hours_profile: input.operational_hours_profile,
          work_schedule_id: input.work_schedule_id,
          created_by: input.userId,
          updated_by: input.userId,
        })
        .select('id')
        .single();
      if (pErr) throw pErr;
      const policyId = policy?.id as string;
      if (input.conditions.length > 0) {
        const { error: cErr } = await supabase.from('organization_sla_policy_conditions').insert(
          input.conditions.map((c) => ({
            policy_id: policyId,
            field: c.field,
            operator: c.operator,
            value: c.value.trim(),
          })),
        );
        if (cErr) {
          await supabase.from('organization_sla_policies').delete().eq('id', policyId);
          throw cErr;
        }
      }
      return policyId;
    },
    onSuccess: (_, v) => {
      invalidateSlaQueries(queryClient, v.organizationId);
    },
  });
}

export type UpdateSlaPolicyInput = CreateSlaPolicyInput & { policyId: string };

export function useUpdateOrganizationSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSlaPolicyInput) => {
      const { error: uErr } = await supabase
        .from('organization_sla_policies')
        .update({
          name: input.name.trim().slice(0, 120),
          description: (input.description ?? '').trim().slice(0, 500),
          status: input.status,
          priority: input.priority,
          first_response_sla_minutes: input.first_response_sla_minutes,
          resolution_sla_minutes: input.resolution_sla_minutes,
          inter_reply_sla_minutes: input.inter_reply_sla_minutes,
          operational_hours_profile: input.operational_hours_profile,
          work_schedule_id: input.work_schedule_id,
          updated_by: input.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.policyId)
        .eq('organization_id', input.organizationId);
      if (uErr) throw uErr;
      const { error: dErr } = await supabase
        .from('organization_sla_policy_conditions')
        .delete()
        .eq('policy_id', input.policyId);
      if (dErr) throw dErr;
      if (input.conditions.length > 0) {
        const { error: cErr } = await supabase.from('organization_sla_policy_conditions').insert(
          input.conditions.map((c) => ({
            policy_id: input.policyId,
            field: c.field,
            operator: c.operator,
            value: c.value.trim(),
          })),
        );
        if (cErr) throw cErr;
      }
    },
    onSuccess: (_, v) => {
      invalidateSlaQueries(queryClient, v.organizationId);
    },
  });
}

export function useSetOrganizationSlaPolicyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { organizationId: string; policyId: string; status: 'active' | 'inactive'; userId: string }) => {
      const { error } = await supabase
        .from('organization_sla_policies')
        .update({
          status: payload.status,
          updated_by: payload.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.policyId)
        .eq('organization_id', payload.organizationId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      invalidateSlaQueries(queryClient, v.organizationId);
    },
  });
}

export function useDeleteOrganizationSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { organizationId: string; policyId: string }) => {
      const { error } = await supabase.from('organization_sla_policies').delete().eq('id', payload.policyId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      invalidateSlaQueries(queryClient, v.organizationId);
    },
  });
}

export function useUpsertOrganizationSlaWorkSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      timezone: string;
      weekly_rules: unknown;
    }) => {
      const { data, error } = await supabase
        .from('organization_sla_work_schedules')
        .upsert(
          {
            organization_id: payload.organizationId,
            timezone: payload.timezone.trim() || 'Asia/Jakarta',
            weekly_rules: payload.weekly_rules,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id' },
        )
        .select('id')
        .single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (_, v) => {
      void queryClient.invalidateQueries({ queryKey: scheduleKey(v.organizationId) });
      invalidateSlaQueries(queryClient, v.organizationId);
    },
  });
}
