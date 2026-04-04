import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface SubService {
  id: string;
  name: string;
  service_id: string;
  description: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useSubServices = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['sub_services', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sub_services')
        .select('id, name, service_id, description, organization_id, is_active, created_at, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching sub services:', error);
        throw error;
      }

      return (data || []) as SubService[];
    },
    enabled: !!organizationId,
  });
};
























