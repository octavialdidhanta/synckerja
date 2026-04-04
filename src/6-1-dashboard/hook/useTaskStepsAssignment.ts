import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useMemo } from 'react';

/**
 * Hook to fetch task_steps_assigned for a specific social_media_plan_id
 * Returns the latest assignment (employee_id) for the plan
 */
export const useTaskStepsAssignment = (socialMediaPlanId: string | null) => {
  const { organizationId } = useCurrentOrg();
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['task-steps-assignment', socialMediaPlanId, organizationId],
    queryFn: async () => {
      if (!socialMediaPlanId || !organizationId) return null;
      
      // Query task_steps_assigned with join to task_steps to get social_media_plan_id
      const { data, error } = await supabase
        .from('task_steps_assigned')
        .select(`
          id,
          task_step_id,
          employee_id,
          assigned_at,
          task_steps!inner(
            id,
            social_media_plan_id
          )
        `)
        .eq('task_steps.social_media_plan_id', socialMediaPlanId)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      // Return employee_id from the latest assignment
      return data?.employee_id || null;
    },
    enabled: !!socialMediaPlanId && !!organizationId,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });
  
  return {
    employeeId: data || null,
    isLoading,
    error,
    refetch
  };
};

/**
 * Hook to fetch all task_steps_assigned for multiple social_media_plan_ids
 * Returns a map of planId -> employeeId (latest assignment)
 */
export const useTaskStepsAssignments = (socialMediaPlanIds: string[]) => {
  const { organizationId } = useCurrentOrg();
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['task-steps-assignments', socialMediaPlanIds.join(','), organizationId],
    queryFn: async () => {
      if (socialMediaPlanIds.length === 0 || !organizationId) return new Map();
      
      // Query task_steps_assigned for all plan IDs
      const { data, error } = await supabase
        .from('task_steps_assigned')
        .select(`
          id,
          task_step_id,
          employee_id,
          assigned_at,
          task_steps!inner(
            id,
            social_media_plan_id
          )
        `)
        .in('task_steps.social_media_plan_id', socialMediaPlanIds)
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      
      // Map to get latest assignment per plan
      const assignmentMap = new Map<string, string>();
      const seenPlans = new Set<string>();
      
      (data || []).forEach((assignment: any) => {
        const planId = assignment.task_steps?.social_media_plan_id;
        if (planId && !seenPlans.has(planId)) {
          assignmentMap.set(planId, assignment.employee_id);
          seenPlans.add(planId);
        }
      });
      
      return assignmentMap;
    },
    enabled: socialMediaPlanIds.length > 0 && !!organizationId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });
  
  return {
    assignments: data || new Map(),
    isLoading,
    error,
    refetch
  };
};

