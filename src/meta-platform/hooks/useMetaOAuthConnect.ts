import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { META_GRAPH_VERSION } from '@/meta-platform/constants/metaGraphVersion';
import {
  type MetaOAuthConnectFlow,
  resolveMetaOAuthConfigId,
  resolveMetaOAuthScopes,
} from '@/meta-platform/constants/metaOAuthEnv';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

const META_OAUTH_VERSION = META_GRAPH_VERSION;
const OAUTH_POPUP_POLL_MS = 500;
const OAUTH_POPUP_MAX_MS = 5 * 60 * 1000;

export type MetaOAuthExchangeResult = {
  accounts_synced?: number;
  facebook_pages_synced?: number;
  webhook_subscribed_count?: number;
  error?: string;
  warning?: string;
};

type UseMetaOAuthConnectArgs = {
  /** Which Business Login configuration + scope set to use. */
  flow?: MetaOAuthConnectFlow;
  /** Overrides env config_id when set (use "" to force omit). */
  oauthConfigId?: string;
  onExchangeComplete?: (result: MetaOAuthExchangeResult) => void | Promise<void>;
};

export function useMetaOAuthConnect(args: UseMetaOAuthConnectArgs = {}) {
  const flow: MetaOAuthConnectFlow = args.flow ?? 'instagram';
  const { t } = useTranslation();
  const [oauthLoading, setOauthLoading] = useState(false);
  const oauthStateRef = useRef('');
  const oauthPopupRef = useRef<Window | null>(null);
  const oauthCompletedRef = useRef(false);
  const oauthPopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthPopupStartedAtRef = useRef(0);

  const metaAppId = (import.meta.env.VITE_META_APP_ID as string)?.trim() || '';
  const metaOAuthConfigId =
    args.oauthConfigId !== undefined
      ? args.oauthConfigId.trim()
      : resolveMetaOAuthConfigId(flow);
  const oauthScope = resolveMetaOAuthScopes(flow);
  const hasOAuth = !!metaAppId;
  const redirectUri =
    typeof window !== 'undefined' ? `${window.location.origin}/auth/meta/callback` : '';

  const isMetaRedirectHttps = redirectUri.startsWith('https://');

  const clearMetaOAuthPopupFlag = useCallback(() => {
    sessionStorage.removeItem('metaOAuthPopupOpen');
    sessionStorage.removeItem('metaOAuthPopupSession');
  }, []);

  const stopOAuthPopupPoll = useCallback(() => {
    if (oauthPopupPollRef.current) {
      clearInterval(oauthPopupPollRef.current);
      oauthPopupPollRef.current = null;
    }
    oauthPopupRef.current = null;
  }, []);

  const startOAuthPopupPoll = useCallback(() => {
    stopOAuthPopupPoll();
    oauthCompletedRef.current = false;
    oauthPopupStartedAtRef.current = Date.now();
    oauthPopupPollRef.current = setInterval(() => {
      const popup = oauthPopupRef.current;
      if (!popup) return;
      const elapsed = Date.now() - oauthPopupStartedAtRef.current;
      if (elapsed > OAUTH_POPUP_MAX_MS) {
        stopOAuthPopupPoll();
        if (!oauthCompletedRef.current) {
          clearMetaOAuthPopupFlag();
          setOauthLoading(false);
        }
        return;
      }
      if (popup.closed && !oauthCompletedRef.current) {
        stopOAuthPopupPoll();
        clearMetaOAuthPopupFlag();
        setOauthLoading(false);
      }
    }, OAUTH_POPUP_POLL_MS);
  }, [clearMetaOAuthPopupFlag, stopOAuthPopupPoll]);

  const exchangeToken = useCallback(
    async (body: Record<string, string>) => {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        await new Promise((r) => setTimeout(r, 600));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session?.access_token) {
        clearMetaOAuthPopupFlag();
        toast.error(t('instagramConnect.notAuthenticated', 'Please sign in again.'));
        setOauthLoading(false);
        return;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-oauth-exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const resData = (await res.json().catch(() => ({}))) as MetaOAuthExchangeResult;
      if (!res.ok) {
        toast.error(resData?.error || t('instagramConnect.oauthExchangeFailed', 'Failed to save token.'));
        setOauthLoading(false);
        return;
      }
      await args.onExchangeComplete?.(resData);
    },
    [args, clearMetaOAuthPopupFlag, t],
  );

  const openOAuthPopup = useCallback(async () => {
    if (!hasOAuth || !redirectUri) {
      toast.error(t('instagramConnect.oauthNotConfigured', 'VITE_META_APP_ID not set.'));
      setOauthLoading(false);
      return;
    }
    const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    oauthStateRef.current = state;
    const params = new URLSearchParams({
      client_id: metaAppId,
      redirect_uri: redirectUri,
      scope: oauthScope,
      state,
    });
    params.set('display', 'page');
    params.set('response_type', 'token');
    // Facebook Page connect: re-show asset picker (Pages) instead of skipping with previous settings.
    if (flow === 'facebook') params.set('auth_type', 'rerequest');
    if (metaOAuthConfigId) params.set('config_id', metaOAuthConfigId);
    const url = `https://www.facebook.com/${META_OAUTH_VERSION}/dialog/oauth?${params.toString()}`;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        sessionStorage.setItem('metaOAuthPopupOpen', Date.now().toString());
        sessionStorage.setItem(
          'metaOAuthPopupSession',
          JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        );
      }
    } catch {
      /* ignore */
    }
    setOauthLoading(true);
    const w = window.open(url, 'meta-oauth', 'width=600,height=700,scrollbars=yes');
    if (!w) {
      clearMetaOAuthPopupFlag();
      setOauthLoading(false);
      toast.error(t('instagramConnect.popupBlocked', 'Popup blocked. Allow popups for this site.'));
      return;
    }
    oauthPopupRef.current = w;
    startOAuthPopupPoll();
  }, [
    clearMetaOAuthPopupFlag,
    hasOAuth,
    metaAppId,
    metaOAuthConfigId,
    oauthScope,
    redirectUri,
    startOAuthPopupPoll,
    t,
  ]);

  useEffect(() => () => stopOAuthPopupPoll(), [stopOAuthPopupPoll]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'meta-oauth') return;
      const data = event.data as {
        code?: string;
        state?: string;
        redirect_uri?: string;
        long_lived_token?: string;
        access_token?: string;
        error?: string;
        error_description?: string;
      };
      if (data.error) {
        oauthCompletedRef.current = true;
        stopOAuthPopupPoll();
        clearMetaOAuthPopupFlag();
        setOauthLoading(false);
        toast.error(
          data.error_description ||
            data.error ||
            t('instagramConnect.oauthDenied', 'Login cancelled or denied.'),
        );
        return;
      }
      const token = data.long_lived_token || data.access_token;
      const code = data.code;
      if (token) {
        if (data.state !== oauthStateRef.current) {
          oauthCompletedRef.current = true;
          stopOAuthPopupPoll();
          clearMetaOAuthPopupFlag();
          setOauthLoading(false);
          return;
        }
        oauthCompletedRef.current = true;
        stopOAuthPopupPoll();
        setOauthLoading(true);
        void (async () => {
          try {
            await exchangeToken({ token });
          } catch {
            toast.error(t('instagramConnect.oauthExchangeFailed', 'Failed to save token.'));
          } finally {
            clearMetaOAuthPopupFlag();
            setOauthLoading(false);
          }
        })();
        return;
      }
      if (code && data.state === oauthStateRef.current) {
        oauthCompletedRef.current = true;
        stopOAuthPopupPoll();
        setOauthLoading(true);
        void (async () => {
          try {
            const exchangeRedirectUri =
              typeof data.redirect_uri === 'string' && data.redirect_uri.trim()
                ? data.redirect_uri.trim()
                : redirectUri;
            await exchangeToken({ code, redirect_uri: exchangeRedirectUri });
          } catch {
            toast.error(t('instagramConnect.oauthExchangeFailed', 'Failed to save token.'));
          } finally {
            clearMetaOAuthPopupFlag();
            setOauthLoading(false);
          }
        })();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [clearMetaOAuthPopupFlag, exchangeToken, redirectUri, stopOAuthPopupPoll, t]);

  return {
    