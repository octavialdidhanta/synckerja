import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function nativeDataToUint8Array(data: unknown): Uint8Array | null {
  if (data == null) return null;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') {
    // Capacitor Android often returns arraybuffer responses as base64 text.
    const cleaned = data.replace(/^data:[^;]+;base64,/, '');
    try {
      const bin = atob(cleaned);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Profile picture for livechat — Instagram via Graph API.
 *
 * ADB proof (Capacitor Android): patched `fetch().blob()` via CapacitorHttp corrupts/skips
 * binary bodies (same class as Drive upload). Native uses CapacitorHttp + arraybuffer → data URL.
 */
export function useLivechatProfilePhoto(
  conversationId: string | null | undefined,
  options: { source?: 'whatsapp' | 'email' | 'instagram' | 'facebook'; channel?: string } = {},
) {
  const { source = 'whatsapp', channel } = options;
  const isInstagram = source === 'instagram';
  const isWhatsApp = source === 'whatsapp' && channel !== 'instagram';
  const isNative = Capacitor.isNativePlatform();

  const { data: profileUrl, isLoading, error } = useQuery({
    queryKey: ['livechat-profile-photo', source, conversationId, isNative ? 'native' : 'web'],
    enabled: isInstagram && Boolean(conversationId),
    queryFn: async (): Promise<string | null> => {
      console.info('[livechat-profile-photo] queryFn_start', {
        conversationId,
        source,
        isNative,
        platform: Capacitor.getPlatform(),
      });
      if (!conversationId) return null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[livechat-profile-photo] ERR_NO_SESSION', { conversationId, source });
        return null;
      }
      const endpoint = `${SUPABASE_URL}/functions/v1/get-instagram-profile-photo`;

      if (isNative) {
        // Prefer JSON base64 (needs deployed function). Fallback: stream via CapacitorHttp arraybuffer.
        const b64Result = await CapacitorHttp.request({
          url: endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          data: { conversation_id: conversationId, base64: true },
          responseType: 'json',
        });
        console.info('[livechat-profile-photo] native_base64_status', {
          conversationId,
          status: b64Result.status,
        });
        if (b64Result.status >= 200 && b64Result.status < 300) {
          const json = (b64Result.data ?? {}) as { base64?: string; content_type?: string };
          const b64 = typeof json.base64 === 'string' ? json.base64.trim() : '';
          if (b64) {
            const contentType = (json.content_type || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
            const dataUrl = `data:${contentType};base64,${b64}`;
            console.info('[livechat-profile-photo] OK_NATIVE_BASE64', { conversationId, contentType });
            return dataUrl;
          }
        }

        const streamResult = await CapacitorHttp.request({
          url: endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          data: { conversation_id: conversationId, stream: true },
          responseType: 'arraybuffer',
        });
        console.info('[livechat-profile-photo] native_stream_status', {
          conversationId,
          status: streamResult.status,
          dataType: typeof streamResult.data,
        });
        if (streamResult.status < 200 || streamResult.status >= 300) {
          console.error('[livechat-profile-photo] ERR_HTTP_NATIVE', {
            conversationId,
            status: streamResult.status,
            data: typeof streamResult.data === 'string' ? streamResult.data.slice(0, 200) : streamResult.data,
          });
          return null;
        }
        const bytes = nativeDataToUint8Array(streamResult.data);
        if (!bytes || bytes.length === 0) {
          console.error('[livechat-profile-photo] ERR_EMPTY_NATIVE_BYTES', { conversationId });
          return null;
        }
        // Reject JSON error payloads mistaken for images.
        if (bytes[0] === 0x7b /* { */) {
          const text = new TextDecoder().decode(bytes).slice(0, 300);
          console.error('[livechat-profile-photo] ERR_NATIVE_JSON_BODY', { conversationId, text });
          return null;
        }
        const headerType = String(streamResult.headers?.['Content-Type'] ?? streamResult.headers?.['content-type'] ?? 'image/jpeg');
        const contentType = headerType.split(';')[0].trim() || 'image/jpeg';
        const dataUrl = bytesToDataUrl(bytes, contentType);
        console.info('[livechat-profile-photo] OK_NATIVE_STREAM', {
          conversationId,
          size: bytes.length,
          contentType,
        });
        return dataUrl;
      }

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ conversation_id: conversationId, stream: true }),
        });
      } catch (err) {
        console.error('[livechat-profile-photo] Failed to fetch', {
          conversationId,
          source,
          endpoint,
          err: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      if (!res.ok) {
        let bodyPreview = '';
        try {
          bodyPreview = (await res.clone().text()).slice(0, 300);
        } catch {
          bodyPreview = '';
        }
        console.error('[livechat-profile-photo] ERR_HTTP', {
          conversationId,
          source,
          status: res.status,
          bodyPreview,
        });
        return null;
      }

      const data = await res.blob();
      if (!data || data.size === 0 || data.type?.includes('json')) {
        console.error('[livechat-profile-photo] ERR_EMPTY_OR_JSON', {
          conversationId,
          size: data?.size ?? 0,
          type: data?.type ?? '',
        });
        return null;
      }
      const objectUrl = URL.createObjectURL(data);
      console.info('[livechat-profile-photo] OK_BLOB', {
        conversationId,
        status: res.status,
        size: data.size,
        type: data.type,
      });
      return objectUrl;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  void isWhatsApp;

  useEffect(() => {
    if (!profileUrl || !profileUrl.startsWith('blob:')) return;
    return () => {
      URL.revokeObjectURL(profileUrl);
      console.info('[livechat-profile-photo] blob_url_revoked', { conversationId });
    };
  }, [profileUrl, conversationId]);

  return { profileUrl: profileUrl ?? null, isLoading, error };
}
