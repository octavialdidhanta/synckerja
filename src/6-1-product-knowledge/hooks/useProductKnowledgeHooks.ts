import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useUserData } from '@/shared/auth/hooks/useUserData';

export interface ProductKnowledgeHook {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  hook_content: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductKnowledgeHookInput {
  name: string;
  description?: string;
  hook_content?: string;
}

export interface UpdateProductKnowledgeHookInput {
  name?: string;
  description?: string;
  hook_content?: string;
}

export const useProductKnowledgeHooks = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['product-knowledge-hooks', organizationId],
    queryFn: async () => {
      // Always fetch default data (organization_id IS NULL and name IS NOT NULL) 
      // This ensures default hooks are always available for multi-tenant use
      
      // Fetch default hooks (organization_id IS NULL) separately
      const { data: defaultHooks, error: defaultError } = await supabase
        .from('product_knowledge_hooks')
        .select('*')
        .is('organization_id', null)
        .not('name', 'is', null)
        .order('created_at', { ascending: false });

      if (defaultError) {
        console.error('❌ Error fetching default product knowledge hooks:', defaultError);
        console.error('Error details:', {
          message: defaultError.message,
          details: defaultError.details,
          hint: defaultError.hint,
          code: defaultError.code
        });
        // Don't throw - continue to fetch organization hooks
      } else {
        console.log('✅ Default hooks fetched:', {
          count: defaultHooks?.length || 0,
          hooks: defaultHooks?.map((h: any) => ({ id: h.id, name: h.name, org_id: h.organization_id })) || []
        });
      }

      // Fetch organization-specific hooks if organizationId exists
      let orgHooks: any[] = [];
      if (organizationId) {
        const { data: orgData, error: orgError } = await supabase
          .from('product_knowledge_hooks')
          .select('*')
          .eq('organization_id', organizationId)
          .not('name', 'is', null)
          .order('created_at', { ascending: false });

        if (orgError) {
          console.error('❌ Error fetching organization product knowledge hooks:', orgError);
          console.error('Error details:', {
            message: orgError.message,
            details: orgError.details,
            hint: orgError.hint,
            code: orgError.code,
            organizationId
          });
          // Don't throw - use default hooks only
        } else {
          orgHooks = orgData || [];
          console.log('✅ Organization hooks fetched:', {
            count: orgHooks.length,
            organizationId,
            hooks: orgHooks.map((h: any) => ({ id: h.id, name: h.name, org_id: h.organization_id }))
          });
        }
      }

      // Combine both results: organization hooks first, then default hooks
      const allHooks = [...orgHooks, ...(defaultHooks || [])];

      // Filter out records where name is null (additional safety check)
      const filteredData = allHooks.filter((hook: any) => hook.name !== null && hook.name !== undefined);

      console.log('📋 Product Knowledge Hooks fetched:', {
        total: filteredData.length,
        organizationId,
        defaultHooksCount: (defaultHooks || []).filter((h: any) => h.name !== null).length,
        orgHooksCount: orgHooks.filter((h: any) => h.name !== null).length,
        hooks: filteredData.map((h: any) => ({
          id: h.id,
          name: h.name,
          organization_id: h.organization_id,
          hasName: !!h.name
        }))
      });

      return filteredData as unknown as ProductKnowledgeHook[];
    },
    // Always enabled to fetch default data even without organizationId
    enabled: true,
  });
};

export const useProductKnowledgeHooksMutations = () => {
  const { organizationId } = useCurrentOrg();
  const { profile } = useUserData();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductKnowledgeHookInput) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      // Get the auth user ID for created_by
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || profile?.user_id || null;

      const { data: result, error } = await supabase
        .from('product_knowledge_hooks')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description || null,
          hook_content: data.hook_content || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating product knowledge hook:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-hooks', organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateProductKnowledgeHookInput;
    }) => {
      // First, check if the hook is a default hook (organization_id IS NULL)
      const { data: existingHook, error: fetchError } = await supabase
        .from('product_knowledge_hooks')
        .select('organization_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching hook:', fetchError);
        throw fetchError;
      }

      // Prevent updating default hooks (organization_id IS NULL)
      if (existingHook && existingHook.organization_id === null) {
        throw new Error('Cannot update default hooks. Default hooks are read-only and available to all tenants.');
      }

      const { data: result, error } = await supabase
        .from('product_knowledge_hooks')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating product knowledge hook:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-hooks', organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, check if the hook is a default hook (organization_id IS NULL)
      const { data: existingHook, error: fetchError } = await supabase
        .from('product_knowledge_hooks')
        .select('organization_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching hook:', fetchError);
        throw fetchError;
      }

      // Prevent deleting default hooks (organization_id IS NULL)
      if (existingHook && existingHook.organization_id === null) {
        throw new Error('Cannot delete default hooks. Default hooks are read-only and available to all tenants.');
      }

      const { error } = await supabase.from('product_knowledge_hooks').delete().eq('id', id);

      if (error) {
        console.error('Error deleting product knowledge hook:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-hooks', organizationId] });
    },
  });

  return {
    createProductKnowledgeHook: createMutation.mutateAsync,
    updateProductKnowledgeHook: updateMutation.mutateAsync,
    deleteProductKnowledgeHook: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

