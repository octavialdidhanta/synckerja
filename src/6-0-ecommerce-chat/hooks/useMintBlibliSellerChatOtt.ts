import { useMutation } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

export type BlibliMintOttResponse = {
  iframeUrl: string;
  sessionHintHours: number;
  connectionId: string;
  storeCode: string;
  requestId: string;
  mintedAt: string;
};

export async function mintBlibliSellerChatOtt(
  organizationId: string,
  connectionId?: string | null,
): Promise<BlibliMintOttResponse> {
  const { data, error } = await supabase.functions.invoke('blibli-seller-chat', {
    body: {
      action: 'mintOtt',
      organization_id: organizationId,
      ...(connectionId ? { connection_id: connectionId } : {}),
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as BlibliMintOttResponse & { error?: string; code?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  if (!payload?.iframeUrl) {
    throw new Error('Missing iframe URL from Blibli mint');
  }
  return payload;
}

export function useMintBlibliSellerChatOtt(organizationId: string | null | undefined) {
  return useMutation({
    mutationFn: async (connectionId?: string | null) => {
      if (!organizationId) throw new Error('No organization');
      return mintBlibliSellerChatOtt(organizationId, connectionId);
    },
  });
}
