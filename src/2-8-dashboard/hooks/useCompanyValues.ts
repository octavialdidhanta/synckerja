
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

interface CompanyValue {
  id: string;
  organization_id: string;
  value_text: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCompanyValues = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: companyValues = [], isLoading } = useQuery({
    queryKey: ['company-values', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('company_values')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching company values:', error);
        throw error;
      }

      return data as CompanyValue[];
    },
    enabled: !!organizationId,
  });

  const addValueMutation = useMutation({
    mutationFn: async (valueText: string) => {
      if (!organizationId) throw new Error('No organization selected');

      const maxSortOrder = Math.max(...companyValues.map(v => v.sort_order), -1);

      const { data, error } = await supabase
        .from('company_values')
        .insert({
          organization_id: organizationId,
          value_text: valueText,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-values', organizationId] });
      toast.success('Company value added successfully');
    },
    onError: (error) => {
      console.error('Error adding company value:', error);
      toast.error('Failed to add company value');
    },
  });

  const removeValueMutation = useMutation({
    mutationFn: async (valueId: string) => {
      const { error } = await supabase
        .from('company_values')
        .delete()
        .eq('id', valueId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-values', organizationId] });
      toast.success('Company value removed successfully');
    },
    onError: (error) => {
      console.error('Error removing company value:', error);
      toast.error('Failed to remove company value');
    },
  });

  return {
    companyValues,
    isLoading,
    addValue: addValueMutation.mutate,
    removeValue: removeValueMutation.mutate,
    isAddingValue: addValueMutation.isPending,
    isRemovingValue: removeValueMutation.isPending,
  };
};
