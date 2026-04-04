import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface ProductKnowledge {
  id: string;
  organization_id: string;
  service_id: string | null;
  sub_service_id: string | null;
  feature_id?: string | null;
  feature_name: string;
  feature_description: string;
  problems_solved: string[];
  problem_tags: string[] | null;
  impact: string;
  solusi: string | null;
  wants: string | null;
  needs: string | null;
  hidden_needs: string | null;
  false_belief: string | null;
  false_belief_impact: string | null;
  what_makes_them_stop: string | null;
  use_cases: any;
  target_audience: any;
  competitive_advantage: any;
  status: string;
  version: number;
  priority: string | null;
  tags: string[] | null;
  categories: string[] | null;
  last_reviewed_date: string | null;
  owner_id: string | null;
  author_id: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  service_name?: string | null;
  sub_service_name?: string | null;
}

/** @deprecated Master features now come from product_knowledge_features table via useProductKnowledgeFeatures */
export const getMasterFeatures = (data: ProductKnowledge[]): ProductKnowledge[] =>
  (data || []).filter((row) => row.feature_id == null);

export const useProductKnowledge = () => {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ['product-knowledge', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Fetch product knowledge
      const { data: productKnowledge, error: pkError } = await supabase
        .from('product_knowledge')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (pkError) {
        console.error('Error fetching product knowledge:', pkError);
        throw pkError;
      }

      if (!productKnowledge || productKnowledge.length === 0) {
        return [];
      }

      // Get unique service_ids and sub_service_ids
      const serviceIds = [...new Set(productKnowledge.map(pk => pk.service_id).filter(Boolean))] as string[];
      const subServiceIds = [...new Set(productKnowledge.map(pk => pk.sub_service_id).filter(Boolean))] as string[];

      // Fetch services
      let services: { [key: string]: string } = {};
      if (serviceIds.length > 0) {
        const { data: servicesData } = await supabase
          .from('services')
          .select('id, name')
          .in('id', serviceIds);

        if (servicesData) {
          services = servicesData.reduce((acc, s) => {
            acc[s.id] = s.name;
            return acc;
          }, {} as { [key: string]: string });
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
          subServices = subServicesData.reduce((acc, ss) => {
            acc[ss.id] = ss.name;
            return acc;
          }, {} as { [key: string]: string });
        }
      }

      // Transform data to include service and sub_service names
      const transformed = productKnowledge.map((pk: any) => ({
        ...pk,
        service_name: pk.service_id ? services[pk.service_id] || null : null,
        sub_service_name: pk.sub_service_id ? subServices[pk.sub_service_id] || null : null,
      }));

      return transformed as ProductKnowledge[];
    },
    enabled: !!organizationId,
  });

  const data = query.data ?? [];

  return {
    ...query,
    data,
  };
};

