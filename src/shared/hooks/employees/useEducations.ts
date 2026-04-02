
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from '@/shared/hooks/useShowToast';

export interface Education {
  id: string;
  employee_id: string;
  institution_name: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade_gpa?: string;
  description?: string;
  is_current: boolean;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export const useEducations = (employeeId: string) => {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  // Fetch educations
  const { data: educations, isLoading, error } = useQuery({
    queryKey: ['educations', employeeId],
    queryFn: async () => {
      console.log('Fetching educations for employee:', employeeId);

      const { data, error } = await supabase
        .from('employee_educations')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching educations:', error);
        throw error;
      }

      console.log('Educations fetched:', data);
      return data as Education[];
    },
    enabled: !!employeeId,
  });

  // Add education
  const addEducation = useMutation({
    mutationFn: async (educationData: Omit<Education, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Adding education:', educationData);

      const { data, error } = await supabase
        .from('employee_educations')
        .insert({
          ...educationData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding education:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Education added successfully:', data);
      
      queryClient.invalidateQueries({ queryKey: ['educations', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Education record added successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error adding education:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to add education record.',
        variant: 'destructive',
      });
    },
  });

  // Update education
  const updateEducation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Education> }) => {
      console.log('Updating education:', id, data);

      const { data: updatedEducation, error } = await supabase
        .from('employee_educations')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating education:', error);
        throw error;
      }

      return updatedEducation;
    },
    onSuccess: (data) => {
      console.log('Education updated successfully:', data);
      
      queryClient.invalidateQueries({ queryKey: ['educations', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Education record updated successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error updating education:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to update education record.',
        variant: 'destructive',
      });
    },
  });

  // Delete education
  const deleteEducation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting education:', id);

      const { error } = await supabase
        .from('employee_educations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting education:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      console.log('Education deleted successfully');
      
      queryClient.invalidateQueries({ queryKey: ['educations', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Education record deleted successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting education:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to delete education record.',
        variant: 'destructive',
      });
    },
  });

  return {
    educations,
    isLoading,
    error,
    addEducation,
    updateEducation,
    deleteEducation,
  };
};

