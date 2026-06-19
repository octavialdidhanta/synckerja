import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

/**
 * Profile picture for livechat header — WhatsApp (disabled until edge deployed) or Instagram via Graph API.
 */
export function useLivechatProfilePhoto(
  conversationId: string | null | undefined,
  options: { source?: 'whatsapp' | 'email' | 'instagram'; channel?: string } = {}
) {
  const { source = 'whatsapp', channel } = options;
  const isInstagram = source === 'instagram';
  const isWhatsApp = source === 'whatsapp' && channel !== 'instagram';
  const blobUrlRef = useRef<string | null>(null);

  const { data: profileUrl, isLoading, error } = useQuery({
    queryKey: ['livechat-profile-photo', source, conversationId],
    enabled: isInstagram && Boolean(conversationId),
    queryFn: async (): Promise<string | null> => {
      if (!conversationId) return null;
      const { data: { session } } = await supabase.auth.getSession();
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
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(data);
      blobUrlRef.current = url;
      return url;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // WhatsApp profile photo remains disabled (Cloud API limitation).
  void isWhatsApp;

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (profileUrl && profileUrl.startsWith('blob:')) return;
    blobUrlRef.current = null;
  }, [profileUrl]);

  return { profileUrl: profileUrl ?? null, isLoading, error };
}
