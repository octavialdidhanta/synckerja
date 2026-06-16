
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { usePenaltyMigrationStatus } from '@/features/2-3-settings/hooks/useLocationManagement';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';

export interface AttendancePenalty {
  id: string;
  attendance_log_id: string;
  employee_id: string;
  organization_id: string;
  penalty_rule_id: string;
  penalty_amount: number;
  penalty_reason: string;
  applied_date: string;
  status: 'active' | 'waived' | 'appealed' | 'paid' | 'cancelled';
  waived_by?: string;
  waived_at?: string;
  waiver_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  employees?: { full_name: string };
  penalty_rules?: { name: string; rule_type: string };
}

export const attendancePenaltiesQueryKey = (organizationId?: string | null) =>
  ['attendance-penalties', organizationId] as const;

async function fetchAttendancePenalties(organizationId: string): Promise<AttendancePenalty[]> {
  const { data, error } = await supabase
    .from('attendance_penalties')
    .select(`
      *,
      employees:employee_id (
        id,
        full_name,
        email
      ),
      penalty_rules:penalty_rule_id (
        id,
        name,
        rule_type,
        calculation_type,
        penalty_amount
      )
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching penalties:', error);
    return [];
  }

  return (data || []).map((penalty: any) => ({
    id: penalty.id,
    attendance_log_id: penalty.attendance_record_id || '',
    employee_id: penalty.employee_id,
    organization_id: penalty.organization_id,
    penalty_rule_id: penalty.penalty_rule_id,
    penalty_amount: penalty.penalty_amount,
    penalty_reason: penalty.penalty_reason,
    applied_date: penalty.applied_date,
    status: penalty.status as AttendancePenalty['status'],
    waived_by: penalty.waived_by,
    waived_at: penalty.waived_at,
    waiver_reason: penalty.waiver_reason,
    notes: penalty.notes || penalty.appeal_notes,
    created_at: penalty.created_at,
    updated_at: penalty.updated_at,
    employees: penalty.employees || undefined,
    penalty_rules: penalty.penalty_rules || undefined,
  }));
}

export const useAttendancePenalties = () => {
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isPenaltyMigrationComplete } = usePenaltyMigrationStatus();

  const {
    data: penalties = [],
    isPending,
    refetch,
  } = useQuery({
    queryKey: attendancePenaltiesQueryKey(organizationId),
    queryFn: () => fetchAttendancePenalties(organizationId!),
    enabled: Boolean(organizationId && isPenaltyMigrationComplete),
    ...attendanceHRQueryDefaults,
  });

  const loading = Boolean(isPenaltyMigrationComplete && organizationId && isPending);

  const waivePenalty = async (id: string, reason: string) => {
    if (!isPenaltyMigrationComplete) {
      throw new Error('Penalty system not available. Please run the database migration first.');
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('attendance_penalties')
        .update({
          status: 'waived',
          waiver_reason: reason,
          waived_by: user.user?.id,
          waived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: attendancePenaltiesQueryKey(organizationId) });

      toast({
        title: 'Success',
        description: 'Penalty waived successfully',
      });

      return { success: true };
    } catch (error) {
      console.error('Error waiving penalty:', error);
      toast({
        title: 'Error',
        description: 'Failed to waive penalty',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const appealPenalty = async (id: string, notes: string) => {
    if (!isPenaltyMigrationComplete) {
      throw new Error('Penalty system not available. Please run the database migration first.');
    }

    try {
      const { error } = await supabase
        .from('attendance_penalties')
        .update({
          status: 'appealed',
          appeal_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: attendancePenaltiesQueryKey(organizationId) });

      toast({
        title: 'Success',
        description: 'Penalty appeal submitted successfully',
      });

      return { success: true };
    } catch (error) {
      console.error('Error appealing penalty:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit penalty appeal',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const fetchPenalties = async () => {
    await refetch();
  };

  return {
    penalties,
    loading,
    fetchPenalties,
    waivePenalty,
    appealPenalty,
    isPenaltyMigrationComplete,
  };
};
