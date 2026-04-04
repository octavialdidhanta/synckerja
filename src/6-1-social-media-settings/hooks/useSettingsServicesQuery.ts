import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type SettingsServiceRow = {
  id: string;
  name: string;
};

/**
 * Daftar services aktif (org + default), sama filter dengan useMasterData('services').
 */
export function useSettingsServicesQuery() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['settings-active-services', organizationId],
    queryFn: async (): Promise<SettingsServiceRow[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .order('name');

      if (error) throw error;
      return (data as SettingsServiceRow[]) || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
