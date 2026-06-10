import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { dedupeMasterRowsByNamePreferOrg } from '@/6-1-script-generator/utils/dedupeMasterRowsByNamePreferOrg';

export type ContentPillarOption = {
  id: string;
  name: string;
  description?: string | null;
  organization_id?: string | null;
};

/**
 * Daftar content pillars untuk dropdown di Product Knowledge (sama pola dedupe dengan Script Generator).
 */
export function useContentPillarsSelect() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['product-knowledge-content-pillars-select', organizationId],
    queryFn: async (): Promise<ContentPillarOption[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('content_pillars')
        .select('id, name, description, organization_id, is_default')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const rows = (data || []).filter(
        (r): r is ContentPillarOption =>
          Boolean(r?.id && typeof r.name === 'string' && r.name.trim() !== ''),
      );

      return dedupeMasterRowsByNamePreferOrg(rows, organizationId);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
