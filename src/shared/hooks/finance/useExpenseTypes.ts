
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

export interface ExpenseType {
  id: string;
  name: string;
  description?: string;
  organization_id?: string;
  is_active?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExpenseTypeData {
  name: string;
  description?: string;
}

export interface UpdateExpenseTypeData {
  id: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const useExpenseTypes = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: expenseTypes = [],
    isLoading,
    isPending,
    refetch,
    isFetched,
  } = useQuery({
    queryKey: ['expense-types', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('expense_types')
        .select('*')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as ExpenseType[];
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateExpenseTypeData) => {
      if (!organizationId) throw new Error('Organization ID is required');

      const { data: result, error } = await supabase
        .from('expense_types')
        .insert({
          name: data.name,
          description: data.description,
          organization_id: organizationId,
          is_active: true,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type created successfully.",
      });
    },
    onError: (error) => {
      console.error('Create expense type error:', error);
      toast({
        title: "Error",
        description: "Failed to create expense type.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateExpenseTypeData) => {
      const { data: result, error } = await supabase
        .from('expense_types')
        .update({
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Update expense type error:', error);
      toast({
        title: "Error",
        description: "Failed to update expense type.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type deleted successfully.",
      });
    },
    onError: (error) => {
      console.error('Delete expense type error:', error);
      toast({
        title: "Error",
        description: "Failed to delete expense type.",
        variant: "destructive",
      });
    },
  });

  return {
    expenseTypes,
    isLoading,
    isPending,
    refetch,
    isFetched,
    isCreating: createMutation.isPending,
    createExpenseType: createMutation.mutate,
    updateExpenseType: updateMutation.mutate,
    deleteExpenseType: deleteMutation.mutate,
  };
};
