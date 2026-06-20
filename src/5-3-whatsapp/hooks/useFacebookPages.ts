import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface FacebookPageRow {
  id: string;
  organization_id: string;
  facebook_page_id: string;
  page_name: string | null;
  verify_token?: string | null;
  granted_scopes?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFacebookPages() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['facebook-pages', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<FacebookPageRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_facebook_pages')
        .select('id, organization_id, facebook_page_id, page_name, verify_token, granted_scopes, is_active, created_at, updated_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FacebookPageRow[];
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (pageRowId: string) => {
      if (!organizationId) throw new Error('No organization selected');
      const { error } = await supabase
        .from('organization_facebook_pages')
        .delete()
        .eq('id', pageRowId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-pages', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['meta-content-config', organizationId] });
    },
  });

  const subscribeWebhooksMutation = useMutation({
    mutationFn: async (pageRowId?: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/instagram-subscribe-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          pageRowId
            ? { facebook_page_row_id: pageRowId, channel: 'facebook' }
            : { channel: 'facebook' },
        ),
      });
      const json = await res.json().catch(() => ({})) as {
        success?: boolean;
        subscribed_count?: number;
        total?: number;
        error?: string;
        hint?: string;
        results?: Array<{
          success?: boolean;
          error?: string;
          page_label?: string;
          subscribedFields?: string[];
        }>;
      };
      if (!res.ok && res.status !== 207) {
        throw new Error(json?.error ?? 'Failed to enable Messenger webhooks');
      }
      return json;
    },
  });

  return {
    pages: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    disconnectPage: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    subscribeMessengerWebhooks: subscribeWebhooksMutation.mutateAsync,
    isSubscribingWebhooks: subscribeWebhooksMutation.isPending,
  };
}
