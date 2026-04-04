
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { EmployeeTarget, CreateEmployeeTargetRequest, UpdateEmployeeTargetRequest } from '@/6-1-dashboard/types/employee-targets';

export const useEmployeeTargets = (employeeId?: string) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  // Fetch targets
  const { data: targets = [], isLoading, error } = useQuery({
    queryKey: ['employee-targets', organizationId, employeeId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }

      let query = supabase
        .from('employee_targets')
        .select('*')
        .eq('organization_id', organizationId);

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching employee targets:', error);
        throw error;
      }

      return (data || []) as EmployeeTarget[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });

  // Create target mutation
  const { mutateAsync: createTarget, isPending: isCreating } = useMutation({
    mutationFn: async (request: CreateEmployeeTargetRequest) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: profile } = await supabase.auth.getUser();
      if (!profile.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('employee_targets')
        .insert({
          organization_id: organizationId,
          employee_id: request.employee_id,
          target_type: request.target_type,
          target_category: request.target_category,
          start_date: request.start_date,
          end_date: request.end_date,
          target_value: request.target_value,
          current_value: 0,
          progress_percentage: 0,
          status: 'active',
          description: request.description,
          metadata: request.metadata || {},
          created_by: profile.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating employee target:', error);
        throw error;
      }

      return data as EmployeeTarget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-targets'] });
    },
  });

  // Update target mutation
  const { mutateAsync: updateTarget, isPending: isUpdating } = useMutation({
    mutationFn: async ({ targetId, updates }: { targetId: string; updates: UpdateEmployeeTargetRequest }) => {
      const { data, error } = await supabase
        .from('employee_targets')
        .update(updates)
        .eq('id', targetId)
        .select()
        .single();

      if (error) {
        console.error('Error updating employee target:', error);
        throw error;
      }

      return data as EmployeeTarget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-targets'] });
    },
  });

  // Delete target mutation
  const { mutateAsync: deleteTarget, isPending: isDeleting } = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase
        .from('employee_targets')
        .delete()
        .eq('id', targetId);

      if (error) {
        console.error('Error deleting employee target:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-targets'] });
    },
  });

  return {
    targets,
    isLoading,
    error,
    createTarget,
    updateTarget,
    deleteTarget,
    isCreating,
    isUpdating,
    isDeleting,
  };
};

