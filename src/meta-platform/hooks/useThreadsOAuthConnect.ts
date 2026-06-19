import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { THREADS_OAUTH_SCOPES } from '@/meta-platform/constants/metaOAuthScopes';
import { getThreadsAppId, getThreadsOAuthRedirectUri, hasThreadsOAuthConfig, isThreadsRedirectHttps } from '@/meta-platform/constants/threadsAppEnv';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

const OAUTH_POPUP_POLL_MS = 500;
const OAUTH_POPUP_MAX_MS = 5 * 60 * 1000;

export type ThreadsOAuthExchangeResult = {
  threads_accounts_synced?: number;
  threads_username?: string | null;
  error?: string;
};

type UseThreadsOAuthConnectArgs = {
  onExchangeComplete?: (result: ThreadsOAuthExchangeResult) => void | Promise<void>;
};

export function useThreadsOAuthConnect(args: UseThreadsOAuthConnectArgs = {}) {
  const { t } = useTranslation();
  const [oauthLoading, setOauthLoading] = useState(false);
  const oauthStateRef = useRef('');
  const oauthPopupRef = useRef<Window | null>(null);
  const oauthCompletedRef = useRef(false);
  const oauthPopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthPopupStartedAtRef = useRef(0);

  const hasOAuth = hasThreadsOAuthConfig();
  const redirectUri = getThreadsOAuthRedirectUri();

  const clearThreadsOAuthPopupFlag = useCallback(() => {
    sessionStorage.removeItem('threadsOAuthPopupOpen');
    sessionStorage.removeItem('threadsOAuthPopupSession');
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
          clearThreadsOAuthPopupFlag();
          setOauthLoading(false);
        }
        return;
      }
      if (popup.closed && !oauthCompletedRef.current) {
        stopOAuthPopupPoll();
        clearThreadsOAuthPopupFlag();
        setOauthLoading(false);
      }
    }, OAUTH_POPUP_POLL_MS);
  }, [clearThreadsOAuthPopupFlag, stopOAuthPopupPoll]);

  const exchangeCode = useCallback(
    async (code: string, exchangeRedirectUri: string) => {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        await new Promise((r) => setTimeout(r, 600));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session?.access_token) {
        clearThreadsOAuthPopupFlag();
        toast.error(t('instagramConnect.notAuthenticated', 'Please sign in again.'));
        setOauthLoading(false);
        return;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-threads-oauth-exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code, redirect_uri: exchangeRedirectUri }),
      });
      const resData = (await res.json().catch(() => ({}))) as ThreadsOAuthExchangeResult;
      if (!res.ok) {
        toast.error(
          resData?.error ||
            t('instagramConnect.threadsOAuthExchangeFailed', 'Failed to save Threads authorization.'),
        );
        setOauthLoading(false);
        return;
      }
      await args.onExchangeComplete?.(resData);
    },
    [args, clearThreadsOAuthPopupFlag, t],
  );

  const startOAuth = useCallback(async () => {
    const appId = getThreadsAppId();
    if (!appId || !redirectUri) {
      toast.error(
        t(
          'instagramConnect.threadsOAuthNotConfigured',
          'VITE_THREADS_APP_ID not set. Use the Threads API app ID from Meta Developer.',
        ),
      );
      setOauthLoading(false);
      return;
    }
    if (!isThreadsRedirectHttps()) {
      toast.error(
        t(
          'instagramConnect.threadsOAuthHttpsRequired',
          'Threads OAuth requires HTTPS redirect. Open https://localhost:8080 (after dev server restart) and whitelist that URL in Meta, or test from https://office.synckerja.com.',
        ),
        { duration: 14000 },
      );
      setOauthLoading(false);
      return;
    }
    const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    oauthStateRef.current = state;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: THREADS_OAUTH_SCOPES,
      response_type: 'code',
      state,
    });
    const url = `https://threads.net/oauth/authorize?${params.toString()}`;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        sessionStorage.setItem('threadsOAuthPopupOpen', Date.now().toString());
        sessionStorage.setItem(
          'threadsOAuthPopupSession',
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
    const w = window.open(url, 'threads-oauth', 'width=600,height=700,scrollbars=yes');
    if (!w) {
      clearThreadsOAuthPopupFlag();
      setOauthLoading(false);
      toast.error(t('instagramConnect.popupBlocked', 'Popup blocked. Allow popups for this site.'));
      return;
    }
    oauthPopupRef.current = w;
    startOAuthPopupPoll();
  }, [clearThreadsOAuthPopupFlag, redirectUri, startOAuthPopupPoll, t]);

  useEffect(() => () => stopOAuthPopupPoll(), [stopOAuthPopupPoll]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'threads-oauth') return;
      const data = event.data as {
        code?: string;
        state?: string;
        redirect_uri?: string;
        error?: string;
        error_description?: string;
      };
      if (data.error) {
        oauthCompletedRef.current = true;
        stopOAuthPopupPoll();
        clearThreadsOAuthPopupFlag();
        setOauthLoading(false);
        const desc = data.error_description || data.error || '';
        const redirectBlocked =
          /redirect/i.test(desc) && /white.?list|blocked/i.test(desc);
        toast.error(
          redirectBlocked
            ? t(
                'instagramConnect.threadsOAuthRedirectBlocked',
                'Redirect URI not whitelisted in Meta. Add this exact URL under Use cases → Threads API → Settings: {{uri}}',
                { uri: redirectUri },
              )
            : desc || t('instagramConnect.oauthDenied', 'Login cancelled or denied.'),
          { duration: redirectBlocked ? 16000 : undefined },
        );
        return;
      }
      const code = data.code?.trim();
      if (!code || data.state !== oauthStateRef.current) {
        if (code) {
          oauthCompletedRef.current = true;
          stopOAuthPopupPoll();
          clearThreadsOAuthPopupFlag();
          setOauthLoading(false);
        }
        return;
      }
      oauthCompletedRef.current = true;
      stopOAuthPopupPoll();
      setOauthLoading(true);
      void (async () => {
        try {
          const exchangeRedirectUri =
            typeof data.redirect_uri === 'string' && data.redirect_uri.trim()
              ? data.redirect_uri.trim()
              : redirectUri;
          await exchangeCode(code, exchangeRedirectUri);
        } catch {
          toast.error(
            t('instagramConnect.threadsOAuthExchangeFailed', 'Failed to save Threads authorization.'),
          );
        } finally {
          clearThreadsOAuthPopupFlag();
          setOauthLoading(false);
        }
      })();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [clearThreadsOAuthPopupFlag, exchangeCode, redirectUri, stopOAuthPopupPoll, t]);

  return {
    startOAuth,
    oauthLoading,
    hasOAuth,
  };
}
