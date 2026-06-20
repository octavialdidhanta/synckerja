import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface InstagramAccountRow {
  id: string;
  organization_id: string;
  instagram_business_account_id: string;
  facebook_page_id: string | null;
  page_access_token: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
  verify_token: string;
  is_active: boolean;
  facebook_page_name?: string | null;
  granted_scopes?: string[] | null;
  has_instagram?: boolean;
  threads_user_id?: string | null;
  threads_username?: string | null;
  threads_profile_picture_url?: string | null;
  has_threads?: boolean;
  threads_verify_token?: string | null;
  created_at: string;
  updated_at: string;
}

/** Account from list-instagram-accounts (with access_token for connect). */
export interface InstagramAccountFromApi {
  id: string;
  username: string | null;
  name: string | null;
  page_id: string | null;
  access_token: string | null;
}

export function useInstagramAccounts() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['instagram-accounts', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<InstagramAccountRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_instagram_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InstagramAccountRow[];
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (account: InstagramAccountFromApi) => {
      if (!organizationId) throw new Error('No organization selected');
      const verifyToken = `ig_${organizationId.replace(/-/g, '').slice(0, 8)}_${Math.random().toString(36).slice(2, 14)}`;
      const { data, error } = await supabase
        .from('organization_instagram_accounts')
        .upsert(
          {
            organization_id: organizationId,
            instagram_business_account_id: account.id,
            facebook_page_id: account.page_id ?? null,
            page_access_token: account.access_token ?? null,
            instagram_username: account.username ?? null,
            instagram_name: account.name ?? null,
            verify_token: verifyToken,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,instagram_business_account_id', ignoreDuplicates: false }
        )
        .select()
        .single();
      if (error) throw error;
      return data as InstagramAccountRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-accounts', organizationId] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error('No organization selected');
      const { error } = await supabase
        .from('organization_instagram_accounts')
        .delete()
        .eq('id', accountId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-accounts', organizationId] });
    },
  });

  const syncFromWhatsAppMutation = useMutation({
    mutationFn: async (): Promise<InstagramAccountFromApi[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/list-instagram-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({})) as { accounts?: InstagramAccountFromApi[]; error?: string };
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to list Instagram accounts from WhatsApp token');
      }
      return Array.isArray(json.accounts) ? json.accounts : [];
    },
  });

  const subscribeWebhooksMutation = useMutation({
    mutationFn: async (accountId?: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-subscribe-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(accountId ? { account_id: accountId } : {}),
      });
      const json = await res.json().catch(() => ({})) as {
        success?: boolean;
        subscribed_count?: number;
        total?: number;
        error?: string;
        hint?: string;
        results?: Array<{ success?: boolean; error?: string; instagram_username?: string | null }>;
      };
      if (!res.ok && res.status !== 207) {
        throw new Error(json?.error ?? 'Failed to enable Instagram DM webhooks');
      }
      return json;
    },
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    connectAccount: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnectAccount: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    syncAvailableFromWhatsApp: syncFromWhatsAppMutation.mutateAsync,
    isSyncingFromWhatsApp: syncFromWhatsAppMutation.isPending,
    subscribeInstagramWebhooks: subscribeWebhooksMutation.mutateAsync,
  };
}
