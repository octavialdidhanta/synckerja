import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useServices = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['services', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('services')
        .select('id, name, description, organization_id, is_active, created_at, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching services:', error);
        throw error;
      }

      return (data || []) as Service[];
    },
    enabled: !!organizationId,
  });
};
























