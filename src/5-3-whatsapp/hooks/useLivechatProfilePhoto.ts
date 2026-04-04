import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

/**
 * Returns profile picture URL for a WhatsApp conversation (from Meta API via Edge Function).
 * Uses stream mode (proxy image) so the photo loads even when Meta URL requires auth.
 * Only runs when conversation is WhatsApp (not Instagram, not email).
 * Uses direct fetch + session to avoid 404/cache issues with functions.invoke.
 */
export function useLivechatProfilePhoto(
  conversationId: string | null | undefined,
  options: { source?: 'whatsapp' | 'email' | 'instagram'; channel?: string } = {}
) {
  const { source = 'whatsapp', channel } = options;
  const isWhatsApp = source === 'whatsapp' && channel !== 'instagram';
  const blobUrlRef = useRef<string | null>(null);

  // Disabled: Edge Function get-whatsapp-profile-photo must be deployed to enable; when not deployed it returns 404 and triggers console errors.
  const { data: profileUrl, isLoading, error } = useQuery({
    queryKey: ['livechat-profile-photo', conversationId],
    enabled: false,
    queryFn: async (): Promise<string | null> => {
      if (!conversationId) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-whatsapp-profile-photo`, {
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
