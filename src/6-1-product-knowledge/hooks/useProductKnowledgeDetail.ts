import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useUserData } from '@/shared/auth/hooks/useUserData';

export interface ProductKnowledgeDetail {
  id: string;
  organization_id: string;
  service_id: string | null;
  sub_service_id: string | null;
  /** Tag pillar (M:N via `product_knowledge_detail_content_pillars`). */
  content_pillar_ids: string[];
  /** Target market / label singkat di UI (kolom `title`) */
  title: string;
  /** Sudut pandang / perspective */
  perspective: string;
  product_knowledge_content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  service_name?: string | null;
  sub_service_name?: string | null;
  /** Nama pillar yang dipetakan dari `content_pillar_ids`, urut nama. */
  content_pillar_names?: string[];
}

export interface CreateProductKnowledgeDetailInput {
  service_id: string | null;
  sub_service_id: string | null;
  content_pillar_ids?: string[];
  title?: string;
  perspective?: string;
  product_knowledge_content: string;
}

export interface UpdateProductKnowledgeDetailInput {
  service_id?: string | null;
  sub_service_id?: string | null;
  content_pillar_ids?: string[];
  title?: string;
  perspective?: string;
  product_knowledge_content?: string;
}

export const useProductKnowledgeDetail = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['product-knowledge-detail', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

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

      const detailIds = productKnowledgeDetail.map((r) => r.id);

      const { data: linkRows, error: linkErr } = await supabase
        .from('product_knowledge_detail_content_pillars')
        .select('product_knowledge_detail_id, content_pillar_id')
        .in('product_knowledge_detail_id', detailIds);

      if (linkErr) {
        console.error('Error fetching detail content pillars:', linkErr);
        throw linkErr;
      }

      const pillarsByDetail = new Map<string, string[]>();
      for (const row of linkRows || []) {
        const did = row.product_knowledge_detail_id as string;
        const pid = row.content_pillar_id as string;
        if (!did || !pid) continue;
        const list = pillarsByDetail.get(did) || [];
        if (!list.includes(pid)) list.push(pid);
        pillarsByDetail.set(did, list);
      }

      const allPillarIds = [...new Set((linkRows || []).map((r) => r.content_pillar_id).filter(Boolean))] as string[];

      // Get unique service_ids and sub_service_ids
      const serviceIds = [
        ...new Set(productKnowledgeDetail.map((pkd) => pkd.service_id).filter(Boolean)),
      ] as string[];
      const subServiceIds = [
        ...new Set(productKnowledgeDetail.map((pkd) => pkd.sub_service_id).filter(Boolean)),
      ] as string[];

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

      let pillarNamesById: { [key: string]: string } = {};
      if (allPillarIds.length > 0) {
        const { data: pillarsData } = await supabase
          .from('content_pillars')
          .select('id, name')
          .in('id', allPillarIds);

        if (pillarsData) {
          pillarNamesById = pillarsData.reduce(
            (acc, p) => {
              acc[p.id] = p.name;
              return acc;
            },
            {} as { [key: string]: string }
          );
        }
      }

      const transformed = productKnowledgeDetail.map((pkd: any) => {
        const cpIds = pillarsByDetail.get(pkd.id) || [];
        const names = cpIds
          .map((id) => pillarNamesById[id])
          .filter((n): n is string => Boolean(n && String(n).trim() !== ''))
          .sort((a, b) => a.localeCompare(b));
        return {
          ...pkd,
          content_pillar_ids: cpIds,
          content_pillar_names: names,
          title: typeof pkd.title === 'string' ? pkd.title : '',
          perspective: typeof pkd.perspective === 'string' ? pkd.perspective : '',
          service_name: pkd.service_id ? services[pkd.service_id] || null : null,
          sub_service_name: pkd.sub_service_id ? subServices[pkd.sub_service_id] || null : null,
        };
      });

      return transformed as ProductKnowledgeDetail[];
    },
    enabled: !!organizationId,
  });
};

async function replaceDetailContentPillars(detailId: string, pillarIds: string[]) {
  const unique = [...new Set(pillarIds.filter(Boolean))];
  const { error: delErr } = await supabase
    .from('product_knowledge_detail_content_pillars')
    .delete()
    .eq('product_knowledge_detail_id', detailId);
  if (delErr) throw delErr;
  if (unique.length === 0) return;
  const { error: insErr } = await supabase.from('product_knowledge_detail_content_pillars').insert(
    unique.map((content_pillar_id) => ({
      product_knowledge_detail_id: detailId,
      content_pillar_id,
    }))
  );
  if (insErr) throw insErr;
}

export const useProductKnowledgeDetailMutations = () => {
  const { organizationId } = useCurrentOrg();
  const { profile } = useUserData();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductKnowledgeDetailInput) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || profile?.user_id || null;

      const pillarIds = [...new Set((data.content_pillar_ids || []).filter(Boolean))];

      const { data: result, error } = await supabase
        .from('product_knowledge_detail')
        .insert({
          organization_id: organizationId,
          service_id: data.service_id,
          sub_service_id: data.sub_service_id,
          title: (data.title ?? '').trim(),
          perspective: (data.perspective ?? '').trim(),
          product_knowledge_content: data.product_knowledge_content,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating product knowledge detail:', error);
        throw error;
      }

      try {
        if (pillarIds.length > 0) {
          await replaceDetailContentPillars(result.id, pillarIds);
        }
      } catch (e) {
        await supabase.from('product_knowledge_detail').delete().eq('id', result.id);
        throw e;
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
      const { content_pillar_ids, ...rowUpdate } = data;
      const payload: Record<string, unknown> = {};
      if (rowUpdate.service_id !== undefined) payload.service_id = rowUpdate.service_id;
      if (rowUpdate.sub_service_id !== undefined) payload.sub_service_id = rowUpdate.sub_service_id;
      if (rowUpdate.title !== undefined) payload.title = (rowUpdate.title ?? '').trim();
      if (rowUpdate.perspective !== undefined) payload.perspective = (rowUpdate.perspective ?? '').trim();
      if (rowUpdate.product_knowledge_content !== undefined) {
        payload.product_knowledge_content = rowUpdate.product_knowledge_content;
      }

      let result: any;
      if (Object.keys(payload).length > 0) {
        const { data: updated, error } = await supabase
          .from('product_knowledge_detail')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating product knowledge detail:', error);
          throw error;
        }
        result = updated;
      } else {
        const { data: existing, error } = await supabase
          .from('product_knowledge_detail')
          .select()
          .eq('id', id)
          .single();
        if (error) {
          console.error('Error loading product knowledge detail:', error);
          throw error;
        }
        result = existing;
      }

      if (content_pillar_ids !== undefined) {
        await replaceDetailContentPillars(id, content_pillar_ids);
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
