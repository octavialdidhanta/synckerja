import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import type { ConnectEmailImapPayload, EmailConnection, EmailConnectionInsert } from '../types';

const QUERY_KEY = ['email-connections'] as const;

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

export function useEmailConnections() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, organizationId],
    enabled: !!organizationId,
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      const needsPoll = rows.some(
        (c) =>
          c.status === 'pending_verification' ||
          (c.connection_method === 'imap' && (!c.imap_last_sync_at || Boolean(c.imap_sync_error))),
      );
      return needsPoll ? 15_000 : false;
    },
    queryFn: async (): Promise<EmailConnection[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_email_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailConnection[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (payload: EmailConnectionInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      const { data, error } = await supabase
        .from('organization_email_connections')
        .insert({
          organization_id: organizationId,
          email_address: payload.email_address.trim(),
          inbound_address: payload.inbound_address.trim(),
          provider: payload.provider?.trim() || null,
          status: payload.status ?? 'pending_verification',
        })
        .select()
        .single();
      if (error) throw error;
      return data as EmailConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, organizationId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending_verification' | 'verified' }) => {
      const { data, error } = await supabase
        .from('organization_email_connections')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as EmailConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, organizationId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('organization_email_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, organizationId] });
    },
  });

  const connectImapMutation = useMutation({
    mutationFn: async (payload: ConnectEmailImapPayload) => {
      const token = await getAccessToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/connect-email-imap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        connection?: EmailConnection;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to connect email via IMAP.');
      return json.connection as EmailConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, organizationId] });
    },
  });

  const syncImapMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const token = await getAccessToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/connect-email-imap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'sync', connection_id: connectionId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        connection?: EmailConnection;
      };
      if (!res.ok) throw new Error(json.error ?? 'Gagal sinkron IMAP.');
      return json.connection as EmailConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, organizationId] });
    },
  });

  return {
    connections: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    insertConnection: insertMutation.mutateAsync,
    insertConnectionMutation: insertMutation,
    connectImap: connectImapMutation.mutateAsync,
    connectImapMutation,
    syncImap: syncImapMutation.mutateAsync,
    syncImapMutation,
    updateStatus: updateStatusMutation.mutateAsync,
    deleteConnection: deleteMutation.mutateAsync,
  };
}
