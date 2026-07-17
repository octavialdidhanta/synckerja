import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type LeadMagnetWhatsAppAccount = {
  id: string;
  display_phone_number: string | null;
  whatsapp_business_name: string | null;
};

export function useLeadMagnetWhatsAppAccounts() {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ['lead-magnet-wa-accounts', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<LeadMagnetWhatsAppAccount[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_whatsapp_accounts')
        .select('id, display_phone_number, whatsapp_business_name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LeadMagnetWhatsAppAccount[];
    },
    staleTime: 60_000,
  });

  const orgHasWhatsApp = useMemo(() => (query.data?.length ?? 0) > 0, [query.data]);

  return {
    accounts: query.data ?? [],
    orgHasWhatsApp,
    isLoading: query.isLoading,
  };
}
