import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface InstagramAccountRow {
  id: string;
  organization_id: string;
  instagram_business_account_id: string;
  facebook_page_id: string | null;
  /** True when the page token is stored. The token itself is never sent to the browser. */
  has_page_access_token: boolean;
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

/** Account from list-instagram-accounts. Page tokens stay on the server (connect happens there too). */
export interface InstagramAccountFromApi {
  id: string;
  username: string | null;
  name: string | null;
  page_id: string | null;
}

/** Every organization_instagram_accounts column the browser may read (page token is server-only). */
export const INSTAGRAM_ACCOUNT_COLUMNS =
  'id, organization_id, instagram_business_account_id, facebook_page_id, has_page_access_token, instagram_username, instagram_name, verify_token, is_active, created_at, updated_at, facebook_page_name, granted_scopes, has_instagram, threads_user_id, threads_username, threads_profile_picture_url, has_threads, threads_token_expires_at, threads_verify_token, threads_dm_inbox_primary';

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
        .select(INSTAGRAM_ACCOUNT_COLUMNS)
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
      // The server looks the page token up at Meta and stores it; the browser never handles it.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/list-instagram-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'connect',
          organization_id: organizationId,
          instagram_business_account_id: account.id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { account?: InstagramAccountRow; error?: string };
      if (!res.ok || !json.account) throw new Error(json?.error ?? 'Failed to connect Instagram account');
      return json.account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-accounts', organizationId] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      if (!organizationId) throw new Error('No organization selected');
      const { data, error } = await supabase
        .from('organization_instagram_accounts')
        .delete()
        .eq('id', accountId)
        .eq('organization_id', organizationId)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Hanya owner atau admin yang bisa memutus koneksi.');
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
