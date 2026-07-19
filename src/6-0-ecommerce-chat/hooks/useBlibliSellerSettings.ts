import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

export type BlibliSellerConnectionRow = {
  id: string;
  store_code: string;
  store_id: number;
  username: string;
  display_name: string | null;
  is_default: boolean;
  status: string;
  has_api_seller_key: boolean;
  has_signature_key: boolean;
  last_mint_at: string | null;
  last_mint_ok: boolean | null;
  last_mint_error: string | null;
  created_at: string;
  updated_at: string;
};

export type BlibliSellerSettingsResponse = {
  connected: boolean;
  connections: BlibliSellerConnectionRow[];
  serverConfigured: boolean;
  apiClientId: string | null;
  channelId: string | null;
};

export type BlibliSellerConnectInput = {
  store_code: string;
  username: string;
  store_id: number;
  api_seller_key: string;
  signature_key?: string;
  display_name?: string;
  is_default?: boolean;
};

async function invokeConfig(
  organizationId: string,
  action: string,
  extra?: Record<string, unknown>,
) {
  const { data, error } = await supabase.functions.invoke('blibli-seller-config', {
    body: { action, organization_id: organizationId, ...extra },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string } | BlibliSellerSettingsResponse | { ok?: boolean };
  if (payload && 'error' in payload && payload.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useBlibliSellerSettings(
  organizationId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryKey = ['blibli-seller-settings', organizationId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return null;
      return (await invokeConfig(organizationId, 'getSettings')) as BlibliSellerSettingsResponse;
    },
    enabled: Boolean(organizationId) && options?.enabled !== false,
    staleTime: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const connect = useMutation({
    mutationFn: async (input: BlibliSellerConnectInput) => {
      if (!organizationId) throw new Error('No organization');
      await invokeConfig(organizationId, 'connect', input);
    },
    onSuccess: invalidate,
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId?: string) => {
      if (!organizationId) throw new Error('No organization');
      await invokeConfig(
        organizationId,
        'disconnect',
        connectionId ? { connection_id: connectionId } : {},
      );
    },
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!organizationId) throw new Error('No organization');
      await invokeConfig(organizationId, 'setDefault', { connection_id: connectionId });
    },
    onSuccess: invalidate,
  });

  return {
    ...query,
    connect,
    disconnect,
    setDefault,
    invalidate,
  };
}
