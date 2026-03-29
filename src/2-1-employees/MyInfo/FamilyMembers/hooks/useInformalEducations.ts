
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from './useShowToast';

export interface InformalEducation {
  id: string;
  employee_id: string;
  course_name: string;
  provider?: string;
  field_of_certification?: string;
  certificate_number?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export const useInformalEducations = (employeeId: string) => {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  // Fetch informal educations
  const { data: informalEducations, isLoading, error } = useQuery({
    queryKey: ['informal-educations', employeeId],
    queryFn: async () => {
      console.log('Fetching informal educations for employee:', employeeId);

      const { data, error } = await supabase
        .from('employee_informal_educations')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching informal educations:', error);
        throw error;
      }

      console.log('Informal educations fetched:', data);
      return data as InformalEducation[];
    },
    enabled: !!employeeId,
  });

  // Add informal education
  const addInformalEducation = useMutation({
    mutationFn: async (educationData: Omit<InformalEducation, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Adding informal education:', educationData);

      const { data, error } = await supabase
        .from('employee_informal_educations')
        .insert({
          ...educationData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding informal education:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Informal education added successfully:', data);
      
      queryClient.invalidateQueries({ queryKey: ['informal-educations', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Informal education record added successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error adding informal education:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to add informal education record.',
        variant: 'destructive',
      });
    },
  });

  // Update informal education
  const updateInformalEducation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InformalEducation> }) => {
      console.log('Updating informal education:', id, data);

      const { data: updatedEducation, error } = await supabase
        .from('employee_informal_educations')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating informal education:', error);
        throw error;
      }

      return updatedEducation;
    },
    onSuccess: (data) => {
      console.log('Informal education updated successfully:', data);
      
      queryClient.invalidateQueries({ queryKey: ['informal-educations', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Informal education record updated successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error updating informal education:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to update informal education record.',
        variant: 'destructive',
      });
    },
  });

  // Delete informal education
  const deleteInformalEducation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting informal education:', id);

      const { error } = await supabase
        .from('employee_informal_educations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting informal education:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      console.log('Informal education deleted successfully');
      
      queryClient.invalidateQueries({ queryKey: ['informal-educations', employeeId] });
      
      showToast({
        title: 'Success',
        description: 'Informal education record deleted successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting informal education:', error);
      
      showToast({
        title: 'Error',
        description: error.message || 'Failed to delete informal education record.',
        variant: 'destructive',
      });
    },
  });

  return {
    informalEducations,
    isLoading,
    error,
    addInformalEducation,
    updateInformalEducation,
    deleteInformalEducation,
  };
};

