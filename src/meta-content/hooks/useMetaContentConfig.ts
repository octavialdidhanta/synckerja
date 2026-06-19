import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { MetaContentAccount } from '@/meta-platform/types/metaContentTypes';

export async function fetchMetaContentConfig(
  organizationId: string,
): Promise<{ accounts: MetaContentAccount[] }> {
  const { data, error } = await supabase.functions.invoke('meta-content-config', {
    body: { organization_id: organizationId },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { accounts?: MetaContentAccount[]; error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return { accounts: payload.accounts ?? [] };
}

export function useMetaContentConfig(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['meta-content-config', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fetchMetaContentConfig(organizationId!),
    staleTime: 60_000,
  });
}
