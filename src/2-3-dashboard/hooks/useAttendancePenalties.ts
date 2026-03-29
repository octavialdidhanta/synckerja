
import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { usePenaltyMigrationStatus } from '@/features/2-3-settings/hooks/useLocationManagement';

export interface AttendancePenalty {
  id: string;
  attendance_log_id: string;
  employee_id: string;
  organization_id: string;
  penalty_rule_id: string;
  penalty_amount: number;
  penalty_reason: string;
  applied_date: string;
  status: 'active' | 'waived' | 'appealed';
  waived_by?: string;
  waived_at?: string;
  waiver_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  employees?: { full_name: string };
  penalty_rules?: { name: string; rule_type: string };
}

export const useAttendancePenalties = () => {
  const [penalties, setPenalties] = useState<AttendancePenalty[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const { isPenaltyMigrationComplete } = usePenaltyMigrationStatus();

  const fetchPenalties = async (filters?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) => {
    if (!organizationId || !isPenaltyMigrationComplete) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching attendance penalties from database');
      
      // Build query with joins so we have employee & rule data for widgets
      let query = supabase
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
        .eq('organization_id', organizationId);

      // Apply filters
      if (filters?.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('applied_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('applied_date', filters.endDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching penalties:', error);
        setPenalties([]);
        return;
      }

      // Transform data to match interface
      const transformedPenalties: AttendancePenalty[] = (data || []).map((penalty: any) => ({
        id: penalty.id,
        attendance_log_id: penalty.attendance_record_id || '',
        employee_id: penalty.employee_id,
        organization_id: penalty.organization_id,
        penalty_rule_id: penalty.penalty_rule_id,
        penalty_amount: penalty.penalty_amount,
        penalty_reason: penalty.penalty_reason,
        applied_date: penalty.applied_date,
        status: penalty.status as 'active' | 'waived' | 'appealed',
        waived_by: penalty.waived_by,
        waived_at: penalty.waived_at,
        waiver_reason: penalty.waiver_reason,
        notes: penalty.notes || penalty.appeal_notes,
        created_at: penalty.created_at,
        updated_at: penalty.updated_at,
        employees: penalty.employees || undefined,
        penalty_rules: penalty.penalty_rules || undefined
      }));

      setPenalties(transformedPenalties);
    } catch (error) {
      console.error('Error fetching penalties:', error);
      setPenalties([]);
    } finally {
      setLoading(false);
    }
  };

  const waivePenalty = async (id: string, reason: string) => {
    if (!isPenaltyMigrationComplete) {
      throw new Error('Penalty system not available. Please run the database migration first.');
    }

    try {
      console.log('Waiving penalty:', id, 'with reason:', reason);

      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('attendance_penalties')
        .update({
          status: 'waived',
          waiver_reason: reason,
          waived_by: user.user?.id,
          waived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setPenalties(prev => prev.map(penalty => 
        penalty.id === id ? { 
          ...penalty, 
          status: 'waived' as const, 
          waiver_reason: reason,
          waived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } : penalty
      ));

      toast({
        title: "Success",
        description: "Penalty waived successfully",
      });

      return { success: true };
    } catch (error) {
      console.error('Error waiving penalty:', error);
      toast({
        title: "Error",
        description: "Failed to waive penalty",
        variant: "destructive",
      });
      throw error;
    }
  };

  const appealPenalty = async (id: string, notes: string) => {
    if (!isPenaltyMigrationComplete) {
      throw new Error('Penalty system not available. Please run the database migration first.');
    }

    try {
      console.log('Appealing penalty:', id, 'with notes:', notes);

      const { error } = await supabase
        .from('attendance_penalties')
        .update({
          status: 'appealed',
          appeal_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setPenalties(prev => prev.map(penalty => 
        penalty.id === id ? { 
          ...penalty, 
          status: 'appealed' as const, 
          notes,
          updated_at: new Date().toISOString()
        } : penalty
      ));

      toast({
        title: "Success",
        description: "Penalty appeal submitted successfully",
      });

      return { success: true };
    } catch (error) {
      console.error('Error appealing penalty:', error);
      toast({
        title: "Error",
        description: "Failed to submit penalty appeal",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    if (isPenaltyMigrationComplete) {
      fetchPenalties();
    } else {
      setLoading(false);
    }
  }, [organizationId, isPenaltyMigrationComplete]);

  return {
    penalties,
    loading,
    fetchPenalties,
    waivePenalty,
    appealPenalty,
    isPenaltyMigrationComplete,
  };
};
