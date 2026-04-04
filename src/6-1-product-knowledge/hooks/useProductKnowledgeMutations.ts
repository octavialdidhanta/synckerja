import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { ProductKnowledge } from './useProductKnowledge';
import { toast } from 'sonner';

export const useProductKnowledgeMutations = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  // Add product knowledge mutation
  const addProductKnowledgeMutation = useMutation({
    mutationFn: async (newData: Partial<ProductKnowledge>) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      // Fields that reference employees table - exclude if invalid
      const employeeForeignKeys = ['author_id', 'owner_id', 'approved_by'];
      const cleanData = { ...newData };
      
      // Remove invalid employee foreign keys (they must be valid UUIDs that exist in employees table)
      // For new inserts, we'll leave these as null to avoid foreign key constraint errors
      employeeForeignKeys.forEach(key => {
        if (cleanData[key as keyof typeof cleanData]) {
          const value = cleanData[key as keyof typeof cleanData];
          // If value is not a valid UUID format, remove it
          if (typeof value === 'string') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(value)) {
              delete cleanData[key as keyof typeof cleanData];
            }
          } else if (!value) {
            delete cleanData[key as keyof typeof cleanData];
          }
        }
      });

      const dataToInsert = {
        organization_id: organizationId,
        feature_name: cleanData.feature_name || '',
        feature_description: cleanData.feature_description || '',
        problems_solved: cleanData.problems_solved || [],
        impact: cleanData.impact || '',
        solusi: cleanData.solusi || null,
        target_audience: cleanData.target_audience || null,
        // Only include fields that are not undefined and exist in the table
        ...Object.fromEntries(
          Object.entries(cleanData).filter(([key, value]) => {
            // Exclude fields that don't exist in the table
            const excludedFields = ['status', 'version', 'author_id', 'owner_id', 'approved_by'];
            return value !== undefined && !excludedFields.includes(key);
          })
        ),
      };

      const { data, error } = await supabase
        .from('product_knowledge')
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        console.error('Error inserting product knowledge:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (newData) => {
      // Optimistic update - add new data to cache
      if (organizationId) {
        queryClient.setQueryData(
          ['product-knowledge', organizationId],
          (oldData: any) => {
            if (!oldData) return [newData];
            return [newData, ...oldData];
          }
        );
        toast.success('Product knowledge added successfully');
      }
    },
    onError: (error: any) => {
      console.error('Error adding product knowledge:', error);
      toast.error('Failed to add product knowledge');
    },
  });

  // Update product knowledge mutation
  const updateProductKnowledgeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductKnowledge> }) => {
      const { data, error } = await supabase
        .from('product_knowledge')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating product knowledge:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (updatedData) => {
      // Optimistic update
      if (organizationId) {
        queryClient.setQueryData(
          ['product-knowledge', organizationId],
          (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((item: any) =>
              item.id === updatedData.id ? updatedData : item
            );
          }
        );
      }
    },
    onError: (error: any) => {
      console.error('Error updating product knowledge:', error);
      toast.error('Failed to update product knowledge');
    },
  });

  // Delete product knowledge mutation
  const deleteProductKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_knowledge')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      // Optimistic update - remove from cache
      if (organizationId) {
        queryClient.setQueryData(
          ['product-knowledge', organizationId],
          (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.filter((item: any) => item.id !== deletedId);
          }
        );
        toast.success('Product knowledge deleted successfully');
      }
    },
    onError: (error: any) => {
      console.error('Error deleting product knowledge:', error);
      toast.error('Failed to delete product knowledge');
    },
  });

  return {
    addProductKnowledge: (newData: Partial<ProductKnowledge>) =>
      addProductKnowledgeMutation.mutate(newData),
    updateProductKnowledge: (id: string, updates: Partial<ProductKnowledge>) =>
      updateProductKnowledgeMutation.mutate({ id, updates }),
    deleteProductKnowledge: (id: string) =>
      deleteProductKnowledgeMutation.mutate(id),
    isAdding: addProductKnowledgeMutation.isPending,
    isUpdating: updateProductKnowledgeMutation.isPending,
    isDeleting: deleteProductKnowledgeMutation.isPending,
  };
};

