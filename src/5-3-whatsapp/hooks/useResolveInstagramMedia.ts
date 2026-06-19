import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/shared/lib/supabaseClient';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';

const QUERY_KEY = ['instagram-messages'] as const;

export function useResolveInstagramMedia(conversationId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-instagram-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message_id: messageId }),
      });
      const json = await res.json().catch(() => ({})) as { media_url?: string | null; error?: string };
      if (!res.ok) {
        const msg = typeof json?.error === 'string' ? json.error : 'Gagal memuat media.';
        throw new Error(msg);
      }
      if (json.media_url == null && json.error) throw new Error(json.error);
      return json.media_url as string;
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, conversationId] });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat media.');
    },
  });

  return {
    resolve: mutation.mutateAsync,
    isResolving: mutation.isPending,
    resolvingMessageId: mutation.isPending && mutation.variables != null ? mutation.variables : null,
  };
}
