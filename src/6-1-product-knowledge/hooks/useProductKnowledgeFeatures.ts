import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

export interface ProductKnowledgeFeature {
  id: string;
  organization_id: string;
  service_id: string | null;
  feature_name: string;
  feature_description: string | null;
  solution: string | null;
  competitive_advantage: unknown;
  created_at: string;
  updated_at: string;
}

export const useProductKnowledgeFeatures = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['product-knowledge-features', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('product_knowledge_features')
        .select('*')
        .eq('organization_id', organizationId)
        .order('feature_name');

      if (error) {
        console.error('Error fetching product knowledge features:', error);
        throw error;
      }

      return (data || []) as ProductKnowledgeFeature[];
    },
    enabled: !!organizationId,
  });
};

export const useProductKnowledgeFeaturesMutations = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const createMutation = useMutation({
    mutationFn: async (input: {
      service_id?: string | null;
      feature_name: string;
      feature_description?: string | null;
      solution?: string | null;
      competitive_advantage?: unknown;
    }) => {
      if (!organizationId) throw new Error('Organization ID is required');

      const { data, error } = await supabase
        .from('product_knowledge_features')
        .insert({
          organization_id: organizationId,
          service_id: input.service_id ?? null,
          feature_name: input.feature_name.trim(),
          feature_description: input.feature_description ?? null,
          solution: input.solution ?? null,
          competitive_advantage: input.competitive_advantage ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProductKnowledgeFeature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-features', organizationId] });
      toast.success('Feature added successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to add feature');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: {
        service_id?: string | null;
        feature_name?: string;
        feature_description?: string | null;
        solution?: string | null;
        competitive_advantage?: unknown;
      };
    }) => {
      if (!id || input == null) {
        throw new Error('updateFeature requires { id, input }');
      }
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.service_id !== undefined) updates.service_id = input.service_id ?? null;
      if (input.feature_name !== undefined) updates.feature_name = input.feature_name?.trim() ?? null;
      if (input.feature_description !== undefined) updates.feature_description = input.feature_description ?? null;
      if (input.solution !== undefined) updates.solution = input.solution ?? null;
      if (input.competitive_advantage !== undefined) updates.competitive_advantage = input.competitive_advantage ?? null;

      const { data, error } = await supabase
        .from('product_knowledge_features')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProductKnowledgeFeature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-features', organizationId] });
      toast.success('Feature updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to update feature');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_knowledge_features').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-features', organizationId] });
      toast.success('Feature deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err?.message || 'Failed to delete feature');
    },
  });

  return {
    createFeature: createMutation.mutateAsync,
    updateFeature: updateMutation.mutateAsync,
    deleteFeature: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
