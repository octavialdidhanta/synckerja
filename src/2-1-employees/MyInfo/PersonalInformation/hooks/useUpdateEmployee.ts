
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from './useShowToast';

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      console.log('useUpdateEmployee: Starting update for employee:', id);
      console.log('useUpdateEmployee: Update data:', data);

      // Prepare the update data - ensure all fields are mapped correctly
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      // Handle date fields properly - convert empty strings to null
      if (updateData.birth_date === '') updateData.birth_date = null;
      if (updateData.join_date === '') updateData.join_date = null;
      if (updateData.hire_date === '') updateData.hire_date = null;

      // Handle empty string values for foreign keys - convert to null
      if (updateData.department_id === '') updateData.department_id = null;
      if (updateData.job_position_id === '') updateData.job_position_id = null;
      if (updateData.job_level_id === '') updateData.job_level_id = null;
      if (updateData.branch_id === '') updateData.branch_id = null;
      if (updateData.employee_status_id === '') updateData.employee_status_id = null;

      // Handle gender field - convert empty string to null
      if (updateData.gender === '') updateData.gender = null;
      
      // Handle other string fields that might have check constraints
      if (updateData.religion === '') updateData.religion = null;
      if (updateData.marital_status === '') updateData.marital_status = null;
      if (updateData.blood_type === '') updateData.blood_type = null;

      console.log('useUpdateEmployee: Final update data after processing:', updateData);

      const { data: updatedEmployee, error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('useUpdateEmployee: Supabase error:', error);
        throw error;
      }

      console.log('useUpdateEmployee: Successfully updated employee:', updatedEmployee);
      return updatedEmployee;
    },
    onSuccess: (data, variables) => {
      console.log('useUpdateEmployee: Update successful, invalidating queries');
      
      // Invalidate all related queries with consistent query keys
      queryClient.invalidateQueries({ queryKey: ['employees-optimized'] });
      queryClient.invalidateQueries({ queryKey: ['employees-optimized', 'detail', variables.id] });
      
      // Force refetch the specific employee detail
      queryClient.refetchQueries({ queryKey: ['employees-optimized', 'detail', variables.id] });
      
      showToast({
        title: 'Success',
        description: 'Employee information updated successfully.',
      });
    },
    onError: (error: any) => {
      console.error('useUpdateEmployee: Update failed:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to update employee information.',
        variant: 'destructive',
      });
    },
  });
};

