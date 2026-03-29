
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from '@/shared/hooks/useShowToast';

export interface WorkExperience {
  id: string;
  employee_id: string;
  company_name: string;
  position: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  job_description?: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export const useWorkExperiences = (employeeId: string) => {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  // Fetch work experiences
  const { data: workExperiences, isLoading, error } = useQuery({
    queryKey: ['work-experiences', employeeId],
    queryFn: async () => {
      console.log('Fetching work experiences for employee:', employeeId);

      const { data, error } = await supabase
        .from('employee_work_experiences')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching work experiences:', error);
        throw error;
      }

      console.log('Work experiences fetched:', data);
      return data as WorkExperience[];
    },
    enabled: !!employeeId,
  });

  // Add work experience
  const addWorkExperience = useMutation({
    mutationFn: async (experienceData: Omit<WorkExperience, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Adding work experience:', experienceData);

      const { data, error } = await supabase
        .from('employee_work_experiences')
        .insert({
          ...experienceData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding work experience:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Work experience added successfully:', data);
      
      queryClient.invalidateQueries({ queryKey: ['work-experiences', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Work experience record added successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error adding work experience:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to add work experience record.',
        variant: 'destructive',
      });
    },
  });

  // Update work experience
  const updateWorkExperience = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkExperience> }) => {
      console.log('Updating work experience:', id, data);

      const { data: updatedExperience, error } = await supabase
        .from('employee_work_experiences')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating work experience:', error);
        throw error;
      }

      return updatedExperience;
    },
    onSuccess: (data) => {
      console.log('Work experience updated successfully:', data);
      
      queryClient.invalidateQueries({ queryKey: ['work-experiences', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Work experience record updated successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error updating work experience:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to update work experience record.',
        variant: 'destructive',
      });
    },
  });

  // Delete work experience
  const deleteWorkExperience = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting work experience:', id);

      const { error } = await supabase
        .from('employee_work_experiences')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting work experience:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      console.log('Work experience deleted successfully');
      
      queryClient.invalidateQueries({ queryKey: ['work-experiences', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Work experience record deleted successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting work experience:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to delete work experience record.',
        variant: 'destructive',
      });
    },
  });

  return {
    workExperiences,
    isLoading,
    error,
    addWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
  };
};

