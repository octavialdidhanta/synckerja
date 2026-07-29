import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { MetaContentAccount } from '@/meta-platform/types/metaContentTypes';

export async function fetchMetaContentConfig(
  organizationId: string,
): Promise<{ accounts: MetaContentAccount[] }> {
  const [{ data, error }, fbPagesRes] = await Promise.all([
    supabase.functions.invoke('meta-content-config', {
      body: { organization_id: organizationId },
    }),
    supabase
      .from('organization_facebook_pages')
      .select('facebook_page_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
  ]);
  if (error) throw await parseEdgeFunctionError(error, data);
  if (fbPagesRes.error) throw fbPagesRes.error;
  const payload = data as { accounts?: MetaContentAccount[]; error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);

  // Connected Facebook Pages = organization_facebook_pages only (same as omnichannel Integrations).
  // Drop IG-synthesized FB entries that can linger after Page disconnect until edge is redeployed.
  const activeFbIds = new Set(
    (fbPagesRes.data ?? []).map((row) => String(row.facebook_page_id)),
  );
  const accounts = (payload.accounts ?? []).filter(
    (account) => account.platform !== 'facebook' || activeFbIds.has(account.account_id),
  );
  return { accounts };
}

export function useMetaContentConfig(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['meta-content-config', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fetchMetaContentConfig(organizationId!),
    staleTime: 60_000,
  });
}
