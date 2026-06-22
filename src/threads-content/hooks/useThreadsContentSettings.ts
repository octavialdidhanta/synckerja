import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

export type ThreadsContentAccountRow = {
  platform: 'threads';
  account_id: string;
  threads_user_id: string;
  account_label: string;
  avatar_url: string | null;
  granted_scopes: string[];
  instagram_business_account_id: string;
  feature_status: Record<string, { ok: boolean; missing: string[] }>;
};

type SettingsResponse = {
  accounts: ThreadsContentAccountRow[];
  oauthConnected: boolean;
  serverConfigured?: boolean;
  threads_app_id?: string | null;
  requested_oauth_scopes?: string[];
};

async function invokeThreadsApi(organizationId: string, action: string, extra?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('threads-content-api', {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | SettingsResponse;
  if (payload && 'error' in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useThreadsContentSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['threads-content-settings', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeThreadsApi(organizationId, 'getSettings')) as SettingsResponse;
    },
    enabled: Boolean(organizationId) && options?.enabled !== false,
    staleTime: 30_000,
  });
}
