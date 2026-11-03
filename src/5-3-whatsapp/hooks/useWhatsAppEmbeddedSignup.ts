import { useCallback, useEffect, useRef, useState } from 'react';
import { META_GRAPH_VERSION } from '@/meta-platform/constants/metaGraphVersion';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type EmbeddedSignupMode = 'coexistence' | 'cloud_api';

export type EmbeddedSignupNumber = {
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  /** Only for cloud_api: two-step verification PIN, shown once. */
  two_step_pin: string | null;
  sync: { contacts: string | null; history: string | null; error: string | null } | null;
};

export type EmbeddedSignupResult = {
  ok: boolean;
  mode: EmbeddedSignupMode;
  waba_id: string;
  numbers: EmbeddedSignupNumber[];
};

type FbLoginResponse = { authResponse?: { code?: string } | null; status?: string };
type FbSdk = {
  init: (opts: Record<string, unknown>) => void;
  login: (cb: (res: FbLoginResponse) => void, opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
let sdkPromise: Promise<FbSdk> | null = null;

function loadFacebookSdk(appId: string): Promise<FbSdk> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FbSdk>((resolve, reject) => {
    const init = () => {
      if (!window.FB) return reject(new Error('Facebook SDK not available'));
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: META_GRAPH_VERSION });
      resolve(window.FB);
    };
    if (window.FB) return init();
    window.fbAsyncInit = init;
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('Facebook SDK failed to load'));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

type SessionInfo = { wabaId: string | null; phoneNumberId: string | null; cancelledAt: string | null; error: string | null };

/** Reads the WA_EMBEDDED_SIGNUP postMessage sent by Meta's popup. */
export function readEmbeddedSignupEvent(origin: string, data: unknown): Partial<SessionInfo> | null {
  if (!/(^|\.)facebook\.com$/.test(new URL(origin).hostname)) return null;
  let payload: unknown = data;
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== 'object') return null;
  const msg = payload as { type?: string; event?: string; data?: Record<string, unknown> };
  if (msg.type !== 'WA_EMBEDDED_SIGNUP') return null;
  const event = String(msg.event ?? '');
  const body = msg.data ?? {};
  if (event.startsWith('FINISH')) {
    return {
      wabaId: body.waba_id != null ? String(body.waba_id) : null,
      phoneNumberId: body.phone_number_id != null ? String(body.phone_number_id) : null,
    };
  }
  if (event === 'CANCEL') return { cancelledAt: body.current_step != null ? String(body.current_step) : 'unknown' };
  if (event === 'ERROR') return { error: body.error_message != null ? String(body.error_message) : 'signup_error' };
  return null;
}

export function useWhatsAppEmbeddedSignup() {
  const { organizationId } = useCurrentOrg();
  const appId = (import.meta.env.VITE_META_APP_ID as string | undefined)?.trim() || '';
  const configId = (import.meta.env.VITE_META_WA_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined)?.trim() || '';
  const isConfigured = Boolean(appId && configId);
  const [loading, setLoading] = useState(false);
  const session = useRef<SessionInfo>({ wabaId: null, phoneNumberId: null, cancelledAt: null, error: null });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      try {
        const info = readEmbeddedSignupEvent(event.origin, event.data);
        if (info) session.current = { ...session.current, ...info };
      } catch {
        // ignore messages from other origins or malformed URLs
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const callFunction = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session: auth } } = await supabase.auth.getSession();
    if (!auth?.access_token) throw new Error('Sesi habis. Silakan login lagi.');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-embedded-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.access_token}` },
      body: JSON.stringify({ organization_id: organizationId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal menghubungkan WhatsApp.');
    return data;
  }, [organizationId]);

  const connect = useCallback(async (mode: EmbeddedSignupMode): Promise<EmbeddedSignupResult> => {
    if (!isConfigured) throw new Error('Embedded Signup belum dikonfigurasi (VITE_META_APP_ID / VITE_META_WA_EMBEDDED_SIGNUP_CONFIG_ID).');
    if (!organizationId) throw new Error('Pilih organisasi dulu.');
    setLoading(true);
    session.current = { wabaId: null, phoneNumberId: null, cancelledAt: null, error: null };
    try {
      const fb = await loadFacebookSdk(appId);
      const code = await new Promise<string>((resolve, reject) => {
        const extras: Record<string, unknown> = { setup: {}, sessionInfoVersion: '3' };
        if (mode === 'coexistence') extras.featureType = 'whatsapp_business_app_onboarding';
        fb.login((res) => {
          const value = res?.authResponse?.code;
          if (value) resolve(value);
          else reject(new Error(session.current.cancelledAt ? 'Proses dibatalkan.' : 'Login Meta tidak selesai.'));
        }, {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras,
        });
      });
      // The finish event can arrive just after the login callback.
      for (let i = 0; i < 30 && !session.current.wabaId; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (session.current.error) throw new Error(session.current.error);
      if (!session.current.wabaId) throw new Error('Meta tidak mengirim WhatsApp Business Account ID. Coba lagi.');
      return await callFunction({
        action: 'connect',
        mode,
        code,
        waba_id: session.current.wabaId,
        phone_number_id: session.current.phoneNumberId,
      }) as EmbeddedSignupResult;
    } finally {
      setLoading(false);
    }
  }, [appId, configId, isConfigured, organizationId, callFunction]);

  const retrySync = useCallback(
    (phoneNumberId: string) => callFunction({ action: 'retry_sync', phone_number_id: phoneNumberId }),
    [callFunction],
  );

  return { connect, retrySync, loading, isConfigured };
}
