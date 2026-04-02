import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  expense_type_id: string;
  organization_id?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseCategoryData {
  name: string;
  description?: string;
  expense_type_id: string;
}

export const expenseCategoriesQueryKey = (organizationId: string | null | undefined, expenseTypeId?: string) =>
  ['expense-categories', organizationId ?? '', expenseTypeId ?? 'all'] as const;

async function fetchExpenseCategoriesApi(
  organizationId: string,
  expenseTypeId?: string,
): Promise<ExpenseCategory[]> {
  let query = supabase
    .from('expense_categories')
    .select('*')
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .eq('is_active', true);

  if (expenseTypeId) {
    query = query.eq('expense_type_id', expenseTypeId);
  }

  const { data, error } = await query.order('is_default', { ascending: false }).order('name');

  if (error) throw error;
  return (data || []) as ExpenseCategory[];
}

export const useExpenseCategories = (expenseTypeId?: string) => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const queryKey = expenseCategoriesQueryKey(organizationId, expenseTypeId);

  const {
    data: expenseCategories = [],
    isLoading,
    isPending,
    isFetched,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => fetchExpenseCategoriesApi(organizationId!, expenseTypeId),
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (isError && error) {
      toast.error('Failed to load expense categories');
    }
  }, [isError, error]);

  const invalidateCategories = () => {
    void queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
  };

  const createMutation = useMutation({
    mutationFn: async (categoryData: CreateExpenseCategoryData) => {
      if (!organizationId) throw new Error('Organization not found');
      const { error: insertError } = await supabase.from('expense_categories').insert({
        name: categoryData.name,
        description: categoryData.description,
        expense_type_id: categoryData.expense_type_id,
        organization_id: organizationId,
        is_active: true,
        is_default: false,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Expense category created successfully!');
      invalidateCategories();
    },
    onError: () => {
      toast.error('Failed to create expense category');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, categoryData }: { id: string; categoryData: CreateExpenseCategoryData }) => {
      const { error: updateError } = await supabase
        .from('expense_categories')
        .update({
          name: categoryData.name,
          description: categoryData.description,
          expense_type_id: categoryData.expense_type_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Expense category updated successfully!');
      invalidateCategories();
    },
    onError: () => {
      toast.error('Failed to update expense category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('expense_categories').delete().eq('id', id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success('Expense category deleted successfully!');
      invalidateCategories();
    },
    onError: () => {
      toast.error('Failed to delete expense category');
    },
  });

  const createExpenseCategory = async (categoryData: CreateExpenseCategoryData): Promise<boolean> => {
    if (!organizationId) {
      toast.error('Organization not found');
      return false;
    }
    try {
      await createMutation.mutateAsync(categoryData);
      return true;
    } catch {
      return false;
    }
  };

  const updateExpenseCategory = async (id: string, categoryData: CreateExpenseCategoryData): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({ id, categoryData });
      return true;
    } catch {
      return false;
    }
  };

  const deleteExpenseCategory = async (id: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  return {
    expenseCategories,
    isLoading,
    isPending,
    isFetched,
    /** Form simpan (create + update); delete memakai alur terpisah di modal. */
    isCreating: createMutation.isPending || updateMutation.isPending,
    createExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    refetch,
  };
};
