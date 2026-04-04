import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useUserData } from '@/shared/auth/hooks/useUserData';

export interface ProductKnowledgeStyle {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  structure: string | null;
  content_pillar_ids: string[] | null; // Array of content pillar IDs, null or empty means universal (all pillars)
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductKnowledgeStyleInput {
  name: string;
  description?: string;
  structure?: string;
  content_pillar_ids?: string[]; // Array of content pillar IDs, empty or undefined means universal (all pillars)
}

export interface UpdateProductKnowledgeStyleInput {
  name?: string;
  description?: string;
  structure?: string;
  content_pillar_ids?: string[]; // Array of content pillar IDs, empty or undefined means universal (all pillars)
}

export const useProductKnowledgeStyle = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['product-knowledge-style', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('product_knowledge_style')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching product knowledge style:', error);
        throw error;
      }

      return (data || []) as ProductKnowledgeStyle[];
    },
    enabled: !!organizationId,
  });
};

export const useProductKnowledgeStyleMutations = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: profile } = useUserData();

  const createMutation = useMutation({
    mutationFn: async (input: CreateProductKnowledgeStyleInput) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      // Get user ID for created_by
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || profile?.user_id || null;

      const { data, error } = await supabase
        .from('product_knowledge_style')
        .insert({
          organization_id: organizationId,
          name: input.name,
          description: input.description || null,
          structure: input.structure || null,
          content_pillar_ids: input.content_pillar_ids && input.content_pillar_ids.length > 0 
            ? input.content_pillar_ids 
            : [],
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating product knowledge style:', error);
        throw error;
      }

      return data as ProductKnowledgeStyle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-style', organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductKnowledgeStyleInput }) => {
      if (!input) {
        throw new Error('Input is required for update');
      }
      
      if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
        throw new Error('Name is required and cannot be empty for update');
      }

      const updateData: {
        name: string;
        description?: string | null;
        structure?: string | null;
        content_pillar_ids?: string[];
        updated_at: string;
      } = {
        name: input.name.trim(),
        updated_at: new Date().toISOString(),
      };

      // Only update fields that are provided
      if (input.description !== undefined) {
        updateData.description = input.description || null;
      }
      if (input.structure !== undefined) {
        updateData.structure = input.structure || null;
      }
      if (input.content_pillar_ids !== undefined) {
        updateData.content_pillar_ids = input.content_pillar_ids && input.content_pillar_ids.length > 0 
          ? input.content_pillar_ids 
          : [];
      }

      console.log('Updating product knowledge style:', { id, updateData });
      
      const { data, error } = await supabase
        .from('product_knowledge_style')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating product knowledge style:', error);
        console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
        throw error;
      }

      console.log('Successfully updated product knowledge style:', data);
      return data as ProductKnowledgeStyle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-style', organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_knowledge_style').delete().eq('id', id);

      if (error) {
        console.error('Error deleting product knowledge style:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-style', organizationId] });
    },
  });

  return {
    createProductKnowledgeStyle: createMutation.mutateAsync,
    updateProductKnowledgeStyle: updateMutation.mutateAsync,
    deleteProductKnowledgeStyle: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

