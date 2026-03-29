import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

export const useDeleteCompanyObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveId: string) => {
      console.log('🗑️ Deleting company objective:', objectiveId);

      const { error } = await supabase
        .from('company_objectives')
        .delete()
        .eq('id', objectiveId);

      if (error) {
        console.error('❌ Error deleting company objective:', error);
        throw error;
      }

      console.log('✅ Company objective deleted successfully');
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Company objective deleted successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to delete company objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete company objective',
        variant: 'destructive',
      });
    },
  });
};









