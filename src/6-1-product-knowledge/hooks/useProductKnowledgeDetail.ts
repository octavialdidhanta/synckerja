import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useUserData } from '@/shared/auth/hooks/useUserData';

export interface ProductKnowledgeDetail {
  id: string;
  organization_id: string;
  service_id: string | null;
  sub_service_id: string | null;
  product_knowledge_content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  service_name?: string | null;
  sub_service_name?: string | null;
}

export interface CreateProductKnowledgeDetailInput {
  service_id: string | null;
  sub_service_id: string | null;
  product_knowledge_content: string;
}

export interface UpdateProductKnowledgeDetailInput {
  service_id?: string | null;
  sub_service_id?: string | null;
  product_knowledge_content?: string;
}

export const useProductKnowledgeDetail = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['product-knowledge-detail', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Fetch product knowledge detail
      const { data: productKnowledgeDetail, error: pkdError } = await supabase
        .from('product_knowledge_detail')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (pkdError) {
        console.error('Error fetching product knowledge detail:', pkdError);
        throw pkdError;
      }

      if (!productKnowledgeDetail || productKnowledgeDetail.length === 0) {
        return [];
      }

      // Get unique service_ids and sub_service_ids
      const serviceIds = [
        ...new Set(productKnowledgeDetail.map((pkd) => pkd.service_id).filter(Boolean)),
      ] as string[];
      const subServiceIds = [
        ...new Set(productKnowledgeDetail.map((pkd) => pkd.sub_service_id).filter(Boolean)),
      ] as string[];

      // Fetch services
      let services: { [key: string]: string } = {};
      if (serviceIds.length > 0) {
        const { data: servicesData } = await supabase
          .from('services')
          .select('id, name')
          .in('id', serviceIds);

        if (servicesData) {
          services = servicesData.reduce(
            (acc, s) => {
              acc[s.id] = s.name;
              return acc;
            },
            {} as { [key: string]: string }
          );
        }
      }

      // Fetch sub_services
      let subServices: { [key: string]: string } = {};
      if (subServiceIds.length > 0) {
        const { data: subServicesData } = await supabase
          .from('sub_services')
          .select('id, name')
          .in('id', subServiceIds);

        if (subServicesData) {
          subServices = subServicesData.reduce(
            (acc, ss) => {
              acc[ss.id] = ss.name;
              return acc;
            },
            {} as { [key: string]: string }
          );
        }
      }

      // Transform data to include service and sub_service names
      const transformed = productKnowledgeDetail.map((pkd: any) => ({
        ...pkd,
        service_name: pkd.service_id ? services[pkd.service_id] || null : null,
        sub_service_name: pkd.sub_service_id ? subServices[pkd.sub_service_id] || null : null,
      }));

      return transformed as ProductKnowledgeDetail[];
    },
    enabled: !!organizationId,
  });
};

export const useProductKnowledgeDetailMutations = () => {
  const { organizationId } = useCurrentOrg();
  const { profile } = useUserData();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductKnowledgeDetailInput) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      // Get the auth user ID for created_by
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || profile?.user_id || null;

      const { data: result, error } = await supabase
        .from('product_knowledge_detail')
        .insert({
          organization_id: organizationId,
          service_id: data.service_id,
          sub_service_id: data.sub_service_id,
          product_knowledge_content: data.product_knowledge_content,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating product knowledge detail:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-detail', organizationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateProductKnowledgeDetailInput;
    }) => {
      const { data: result, error } = await supabase
        .from('product_knowledge_detail')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating product knowledge detail:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-detail', organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_knowledge_detail').delete().eq('id', id);

      if (error) {
        console.error('Error deleting product knowledge detail:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-knowledge-detail', organizationId] });
    },
  });

  return {
    createProductKnowledgeDetail: createMutation.mutateAsync,
    updateProductKnowledgeDetail: updateMutation.mutateAsync,
    deleteProductKnowledgeDetail: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

