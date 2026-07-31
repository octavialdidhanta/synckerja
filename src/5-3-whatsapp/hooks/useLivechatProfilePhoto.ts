import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

/**
 * Profile picture for livechat — Instagram via Graph API stream.
 * Caches the Blob in React Query (stable across remounts) and creates a
 * fresh object URL per mount so mobile list↔chat swaps don't poison the cache.
 */
export function useLivechatProfilePhoto(
  conversationId: string | null | undefined,
  options: { source?: 'whatsapp' | 'email' | 'instagram'; channel?: string } = {},
) {
  const { source = 'whatsapp', channel } = options;
  const isInstagram = source === 'instagram';
  const isWhatsApp = source === 'whatsapp' && channel !== 'instagram';

  const { data: photoBlob, isLoading, error } = useQuery({
    queryKey: ['livechat-profile-photo', source, conversationId],
    enabled: isInstagram && Boolean(conversationId),
    queryFn: async (): Promise<Blob | null> => {
      if (!conversationId) return null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const endpoint = isInstagram
        ? `${SUPABASE_URL}/functions/v1/get-instagram-profile-photo`
        : `${SUPABASE_URL}/functions/v1/get-whatsapp-profile-photo`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversation_id: conversationId, stream: true }),
      });
      if (!res.ok) return null;
      const data = await res.blob();
      if (!data || data.size === 0 || data.type?.includes('json')) return null;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  // WhatsApp profile photo remains disabled (Cloud API limitation).
  void isWhatsApp;

  const [profileUrl, setProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoBlob) {
      setProfileUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoBlob);
    setProfileUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photoBlob]);

  return { profileUrl, isLoading, error };
}
