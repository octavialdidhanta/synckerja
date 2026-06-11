import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

interface UpdateCompanyObjectiveData {
  id: string;
  title?: string;
  why_important?: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  weight?: number;
  end_date?: string;
}

export const useUpdateCompanyObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UpdateCompanyObjectiveData> }) => {
      console.log('🔄 Updating company objective:', { id, updates });

      const { data, error } = await supabase
        .from('company_objectives')
        .update({ 
          ...updates, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating company objective:', error);
        throw error;
      }

      console.log('✅ Company objective updated successfully:', data);

      // If title or why_important was updated, also update the corresponding key result
      if (updates.title !== undefined || updates.why_important !== undefined) {
        console.log('🔄 Syncing changes to company objective key result');
        
        const updateData: { title?: string } = {};
        if (updates.title !== undefined) {
          updateData.title = updates.title;
        }

        const { data: keyResult, error: keyResultError } = await supabase
          .from('key_results')
          .update(updateData)
          .eq('company_objective_id', id)
          .select()
          .single();

        if (keyResultError) {
          console.error('❌ Error syncing changes to key result:', keyResultError);
        } else {
          console.log('✅ Changes synced to key result:', keyResult);
        }
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      
      toast({
        title: 'Success',
        description: 'Company objective updated successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to update company objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to update company objective',
        variant: 'destructive',
      });
    },
  });
};
