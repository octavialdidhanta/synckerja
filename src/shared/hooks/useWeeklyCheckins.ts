import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { CheckinStatus } from '@/types/okr';

/** ISO date strings (YYYY-MM-DD) for the current calendar week (Monday–Sunday). */
export function getCurrentWeekDates(): { start: string; end: string } {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utc.getUTCDay() || 7;
  if (day !== 1) utc.setUTCDate(utc.getUTCDate() - (day - 1));
  const start = utc.toISOString().slice(0, 10);
  const endDate = new Date(utc);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export type CreateWeeklyCheckinInput = {
  organization_id: string;
  key_result_id: string;
  week_start_date: string;
  current_value: number;
  confidence_level: number;
  status: CheckinStatus;
  comments?: string;
  blockers?: string;
};

export function useCreateWeeklyCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWeeklyCheckinInput) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', input.organization_id)
        .maybeSingle();

      if (empError) throw empError;
      if (!employee?.id) throw new Error('Employee record not found for this organization');

      const { error } = await supabase.from('weekly_checkins').insert({
        organization_id: input.organization_id,
        key_result_id: input.key_result_id,
        employee_id: employee.id,
        week_start_date: input.week_start_date,
        current_value: input.current_value,
        confidence_level: input.confidence_level,
        status: input.status,
        comments: input.comments ?? null,
        blockers: input.blockers ?? null,
      });

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['weekly-checkin-history', variables.key_result_id, variables.organization_id],
      });
    },
  });
}
