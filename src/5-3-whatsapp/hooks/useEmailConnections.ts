import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import type { EmailConnection, EmailConnectionInsert } from '../types';

const QUERY_KEY = ['email-connections'] as const;

export function useEmailConnections() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, organizationId],
    enabled: !!organizationId,
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

  return {
    connections: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    insertConnection: insertMutation.mutateAsync,
    insertConnectionMutation: insertMutation,
    updateStatus: updateStatusMutation.mutateAsync,
    deleteConnection: deleteMutation.mutateAsync,
  };
}
