import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { useDepartmentAccess } from '@/shared/auth/page-access/useDepartmentAccess';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { useWhatsAppConfig } from '../hooks/useWhatsAppConfig';
import { useInstagramAccounts, type InstagramAccountFromApi, type InstagramAccountRow } from '../hooks/useInstagramAccounts';
import { WebhookInfoDisplay } from '../components/connect/WebhookInfoDisplay';
import { InstagramConnectPageSkeleton } from '../skeletons/InstagramConnectPageSkeleton';
import { useInstagramConnectPageSkeletonGate } from '../hooks/useInstagramConnectPageSkeletonGate';
import { Instagram, CheckCircle2, Unplug, Loader2, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { buildMetaOAuthDialogUrl } from '@/meta-platform/constants/buildMetaOAuthDialogUrl';
import { META_BUSINESS_OAUTH_SCOPES } from '@/meta-platform/constants/metaOAuthScopes';
import { getMetaInstagramOAuthConfigId } from '@/meta-platform/constants/metaOAuthEnv';
import { META_GRAPH_VERSION } from '@/meta-platform/constants/metaGraphVersion';
import { MetaScopeStatusCards } from '@/meta-platform/components/MetaScopeStatusCards';

const META_OAUTH_SCOPE = META_BUSINESS_OAUTH_SCOPES;
const META_OAUTH_VERSION = META_GRAPH_VERSION;
const OAUTH_POPUP_POLL_MS = 500;
const OAUTH_POPUP_MAX_MS = 5 * 60 * 1000;

/** `/omnichannel/integrations/instagram` — Seamless Page Scroll Layout (`.cursor/rules/Seamless Page Scroll Layout.mdc`). */
export function InstagramConnectPage() {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const hasOrg = Boolean(organizationId);
  const { config, isLoading: configLoading, ensureInstagramVerifyToken } = useWhatsAppConfig();
  const {
    accounts: connectedAccounts,
    isLoading: accountsLoading,
    refetch: refetchAccounts,
    connectAccount,
    disconnectAccount,
    isConnecting,
    isDisconnecting,
    syncAvailableFromWhatsApp,
    isSyncingFromWhatsApp,
    subscribeInstagramWebhooks,
  } = useInstagramAccounts();

  const [igWebhookBootstrapPending, setIgWebhookBootstrapPending] = useState(false);
  const { canAccessPage, accessDecisionPending } = useDepartmentAccess();
  const { centralProfileHydrated } = useCentralizedUserData();
  const hasInstagramPageAccess =
    centralProfileHydrated &&
    !accessDecisionPending &&
    canAccessPage('/omnichannel/integrations/instagram');

  useLayoutEffect(() => {
    if (!hasOrg || !hasInstagramPageAccess || configLoading || accountsLoading) {
      setIgWebhookBootstrapPending(false);
      return;
    }
    const verifyFromAccount = connectedAccounts[0]?.verify_token?.trim();
    const verifyFromConfig = (config?.instagram_verify_token ?? '').trim();
    if (verifyFromAccount || verifyFromConfig) {
      setIgWebhookBootstrapPending(false);
      return;
    }
    if (!config?.id) {
      setIgWebhookBootstrapPending(false);
      return;
    }
    if ((config.instagram_verify_token ?? '').trim() !== '') {
      setIgWebhookBootstrapPending(false);
      return;
    }
    let cancelled = false;
    setIgWebhookBootstrapPending(true);
    ensureInstagramVerifyToken()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIgWebhookBootstrapPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    hasOrg,
    hasInstagramPageAccess,
    configLoading,
    accountsLoading,
    connectedAccounts,
    config,
    ensureInstagramVerifyToken,
  ]);

  const blockingPagePending =
    orgLoading || (hasOrg && (configLoading || accountsLoading || igWebhookBootstrapPending));
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    blockingPagePending,
    '/omnichannel/integrations/instagram',
  );
  const showPageSkeleton = useInstagramConnectPageSkeletonGate(showFullPageSkeleton);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<InstagramAccountFromApi[]>([]);
  const oauthStateRef = useRef<string>('');
  const oauthPopupRef = useRef<Window | null>(null);
  const oauthCompletedRef = useRef(false);
  const oauthPopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthPopupStartedAtRef = useRef(0);

  const metaAppId = (import.meta.env.VITE_META_APP_ID as string)?.trim() || '';
  const metaOAuthConfigId = getMetaInstagramOAuthConfigId();
  const hasOAuth = !!metaAppId;
  const hasMetaConfig = !!config?.meta_access_token?.trim();
  const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/auth/meta/callback` : '';

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

  const showZeroAccountsWarning = useCallback(() => {
    const checklist = [
      t('instagramConnect.zeroAccountsChecklist.pageLinked', 'Facebook Page must be linked to an Instagram Business Account in Meta Business Suite.'),
      t('instagramConnect.zeroAccountsChecklist.pageAdmin', 'Your Facebook login must have admin access to that Page.'),
      t('instagramConnect.zeroAccountsChecklist.permissions', 'App permissions instagram_business_manage_messages and pages_show_list must be approved.'),
      t('instagramConnect.zeroAccountsChecklist.tryWhatsApp', 'If Connect WhatsApp is already set up, try Sync from WhatsApp token below.'),
    ].join('\n• ');
    toast.warning(t('instagramConnect.zeroAccountsWarning', 'Login succeeded but no Instagram Business account was found.'), {
      description: `• ${checklist}`,
      duration: 12000,
    });
  }, [t]);

  const handleOAuthExchangeResult = useCallback(
    async (resData: {
      accounts_synced?: number;
      webhook_subscribed_count?: number;
      error?: string;
      warning?: string;
    }) => {
      await refetchAccounts();
      setAvailableAccounts([]);
      const synced = typeof resData.accounts_synced === 'number' ? resData.accounts_synced : 0;
      const webhookSynced = typeof resData.webhook_subscribed_count === 'number' ? resData.webhook_subscribed_count : 0;
      if (synced > 0) {
        if (webhookSynced >= synced) {
          toast.success(t('instagramConnect.oauthSuccessWithWebhooks', 'Akun Instagram terhubung. Webhook DM diaktifkan.'));
        } else {
          toast.warning(t('instagramConnect.oauthSuccessWebhookPartial', 'Akun terhubung, tapi webhook DM gagal sebagian.'), {
            description: t(
              'instagramConnect.oauthSuccessWebhookPartialHint',
              'Connect ulang dengan Facebook dan pastikan izin pages_manage_metadata disetujui.',
            ),
            duration: 12000,
          });
        }
      } else {
        showZeroAccountsWarning();
      }
      if (resData.warning?.trim()) {
        toast.info(resData.warning.trim(), { duration: 10000 });
      }
    },
    [refetchAccounts, showZeroAccountsWarning, t],
  );

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

  useEffect(() => () => stopOAuthPopupPoll(), [stopOAuthPopupPoll]);

  // Facebook Login for Business only: redirect_uri must match Valid OAuth Redirect URIs in Meta Developer → Facebook Login for Business → Configurations
  const openOAuthPopup = useCallback(
    async () => {
      if (!hasOAuth || !redirectUri) {
        toast.error(t('instagramConnect.oauthNotConfigured', 'VITE_META_APP_ID not set.'));
        setOauthLoading(false);
        return;
      }
      if (!redirectUri.startsWith('https://')) {
        toast.error(
          t(
            'facebookConnect.oauthHttpsRequired',
            'OAuth Facebook/Instagram wajib HTTPS. Buka https://localhost:8080 (npm run dev:https) atau https://office.synckerja.com.',
          ),
          { duration: 14000 },
        );
        setOauthLoading(false);
        return;
      }
      const state = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      oauthStateRef.current = state;
      const url = buildMetaOAuthDialogUrl({
        appId: metaAppId,
        redirectUri,
        state,
        configId: metaOAuthConfigId,
        scope: META_OAUTH_SCOPE,
        graphVersion: META_OAUTH_VERSION,
      });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          sessionStorage.setItem('metaOAuthPopupOpen', Date.now().toString());
          sessionStorage.setItem('metaOAuthPopupSession', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }));
        }
      } catch (_) {}
      const w = window.open(url, 'meta-oauth', 'width=600,height=700,scrollbars=yes');
      if (!w) {
        clearMetaOAuthPopupFlag();
        setOauthLoading(false);
        toast.error(t('instagramConnect.popupBlocked', 'Popup blocked. Allow popups for this site.'));
        return;
      }
      oauthPopupRef.current = w;
      startOAuthPopupPoll();
    },
    [clearMetaOAuthPopupFlag, hasOAuth, metaAppId, metaOAuthConfigId, redirectUri, startOAuthPopupPoll, t],
  );

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
        const isInvalidScope = data.error === 'invalid_scope';
        toast.error(
          isInvalidScope
            ? t(
                'instagramConnect.oauthInvalidScope',
                'Meta rejected permissions (invalid_scope). In App Dashboard → App Review → Permissions, ensure every permission in your Instagram config is Added, then try Connect again.',
              )
            : data.error_description || data.error || t('instagramConnect.oauthDenied', 'Login cancelled or denied.'),
          { duration: isInvalidScope ? 14000 : 8000 },
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
        (async () => {
          try {
            let session: { access_token?: string } | null = (await supabase.auth.getSession()).data.session;
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
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ token }),
            });
            const resData = await res.json().catch(() => ({})) as { accounts_synced?: number; error?: string; warning?: string };
            if (!res.ok) {
              toast.error(resData?.error || t('instagramConnect.oauthExchangeFailed', 'Failed to save token.'));
              setOauthLoading(false);
              return;
            }
            await handleOAuthExchangeResult(resData);
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
        (async () => {
          try {
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
            const exchangeRedirectUri = (typeof data.redirect_uri === 'string' && data.redirect_uri.trim()) ? data.redirect_uri.trim() : redirectUri;
            const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-oauth-exchange`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ code, redirect_uri: exchangeRedirectUri }),
            });
            const resData = await res.json().catch(() => ({})) as { accounts_synced?: number; error?: string; warning?: string };
            if (!res.ok) {
              clearMetaOAuthPopupFlag();
              toast.error(resData?.error || t('instagramConnect.oauthExchangeFailed', 'Failed to save token.'));
              setOauthLoading(false);
              return;
            }
            await handleOAuthExchangeResult(resData);
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
  }, [clearMetaOAuthPopupFlag, handleOAuthExchangeResult, redirectUri, stopOAuthPopupPoll, t]);

  const handleSyncFromWhatsApp = async () => {
    try {
      const accounts = await syncAvailableFromWhatsApp();
      setAvailableAccounts(accounts);
      if (accounts.length === 0) {
        toast.warning(t('instagramConnect.noAccountsFromMeta', 'No Instagram Business accounts found from WhatsApp token.'));
      } else {
        toast.success(t('instagramConnect.syncFromWhatsAppSuccess', 'Found {{count}} account(s) to connect.', { count: accounts.length }));
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? t('instagramConnect.syncFromWhatsAppFailed', 'Failed to sync from WhatsApp token.'));
    }
  };

  const handleConnect = async (account: InstagramAccountFromApi) => {
    try {
      await connectAccount(account);
      setAvailableAccounts((prev) => prev.filter((a) => a.id !== account.id));
      await refetchAccounts();
      try {
        const sub = await subscribeInstagramWebhooks();
        if (sub.success !== false && (sub.subscribed_count ?? 0) > 0) {
          toast.success(t('instagramConnect.oauthSuccessWithWebhooks', 'Akun Instagram terhubung. Webhook DM diaktifkan.'));
        } else {
          toast.warning(t('instagramConnect.oauthSuccessWebhookPartial', 'Akun terhubung, tapi webhook DM gagal sebagian.'));
        }
      } catch {
        toast.success(t('instagramConnect.oauthSuccess', 'Connected.'));
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Failed to connect');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await disconnectAccount(accountId);
      await refetchAccounts();
      toast.success(t('instagramConnect.disconnect', 'Disconnected'));
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Failed to disconnect');
    }
  };

  const connectedIds = new Set(connectedAccounts.map((a) => a.instagram_business_account_id));
  const availableToConnect = availableAccounts.filter((a) => !connectedIds.has(a.id));

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative flex min-h-full min-w-0 flex-1 flex-col">
              <div
                className={
                  showPageSkeleton
                    ? 'invisible pointer-events-none flex min-h-full min-w-0 flex-1 flex-col'
                    : 'flex min-h-full min-w-0 flex-1 flex-col'
                }
                aria-hidden={showPageSkeleton}
              >
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate pagePath="/omnichannel/integrations/instagram">
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex min-h-0 flex-1 flex-col gap-6">
                      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                      <Card className="flex h-full min-h-0 min-w-0 flex-col">
                        <CardHeader className="shrink-0 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
                              <Instagram className="w-8 h-8 text-[#E4405F]" />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-[#E4405F]">{t('instagramConnect.leftTitle', 'Connect Instagram')}</h2>
                              <p className="text-sm text-gray-500">{t('instagramConnect.leftDescriptionShort', 'OAuth via Facebook atau token dari Connect WhatsApp.')}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col space-y-6 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {!hasMetaConfig ? (
                            <div className="space-y-3">
                              {hasOAuth && (
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setOauthLoading(true);
                                    openOAuthPopup();
                                  }}
                                  disabled={oauthLoading}
                                  className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                                >
                                  {oauthLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Facebook className="w-4 h-4 mr-2" />}
                                  {oauthLoading ? t('instagramConnect.oauthConnecting', 'Connecting…') : t('instagramConnect.connectWithFacebookOnly', 'Connect with Facebook only')}
                                </Button>
                              )}
                              {!hasOAuth && (
                                <p className="text-xs text-amber-700">
                                  {t('instagramConnect.noMetaConfigShort', 'Connect WhatsApp dulu atau set VITE_META_APP_ID.')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {hasOAuth && (
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setOauthLoading(true);
                                    openOAuthPopup();
                                  }}
                                  disabled={oauthLoading}
                                  className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
                                >
                                  {oauthLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Facebook className="w-4 h-4 mr-2" />}
                                  {oauthLoading ? t('instagramConnect.oauthConnecting', 'Connecting…') : t('instagramConnect.connectWithFacebookOnly', 'Connect with Facebook only')}
                                </Button>
                              )}
                              {connectedAccounts.length === 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={handleSyncFromWhatsApp}
                                  disabled={isSyncingFromWhatsApp}
                                >
                                  {isSyncingFromWhatsApp ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : null}
                                  {isSyncingFromWhatsApp
                                    ? t('instagramConnect.syncFromWhatsAppLoading', 'Syncing…')
                                    : t('instagramConnect.syncFromWhatsApp', 'Sync from WhatsApp token')}
                                </Button>
                              )}
                            </div>
                          )}
                          <div className="border-t border-slate-200 pt-4 mt-4">
                            <WebhookInfoDisplay embedded variant="instagram" />
                          </div>
                          {connectedAccounts.length > 0 && (
                            <MetaScopeStatusCards
                              accounts={connectedAccounts}
                              features={['dm', 'comments', 'insights', 'pages']}
                            />
                          )}
                        </CardContent>
                      </Card>

                      <Card className="flex h-full min-h-0 min-w-0 flex-col">
                        <CardHeader className="shrink-0">
                          <CardTitle>{t('instagramConnect.rightTitle', 'Connected accounts')}</CardTitle>
                          <CardDescription>{t('instagramConnect.rightDescription', 'List of connected Instagram Business accounts.')}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col">
                          {connectedAccounts.length === 0 && availableToConnect.length === 0 ? (
                            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                              <Instagram className="mb-3 h-12 w-12 text-slate-300" />
                              <p className="text-sm text-slate-600">
                                {t(
                                  'instagramConnect.noConnectedAccounts',
                                  'No Instagram account connected. Use Connect with Facebook only to authorize.',
                                )}
                              </p>
                            </div>
                          ) : (
                            <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {connectedAccounts.map((acc) => (
                                <div key={acc.id} className="rounded-xl border border-purple-200/70 bg-purple-50/60 p-5 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E4405F]/15">
                                        <Instagram className="h-6 w-6 text-[#E4405F]" />
                                      </div>
                                      <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-slate-900">
                                          {acc.instagram_username
                                            ? `@${acc.instagram_username}`
                                            : acc.instagram_name || acc.instagram_business_account_id}
                                        </h3>
                                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600">
                                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                                          {t('instagramConnect.connected', 'Connected')}
                                        </span>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                      onClick={() => handleDisconnect(acc.id)}
                                      disabled={isDisconnecting}
                                    >
                                      <Unplug className="mr-2 h-4 w-4" />
                                      {t('instagramConnect.disconnect', 'Disconnect')}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {availableToConnect.length > 0 && (
                                <div className="border-t border-slate-200 pt-4">
                                  <p className="mb-2 text-sm font-medium text-slate-700">{t('instagramConnect.availableToConnect', 'Available to connect')}</p>
                                  {availableToConnect.map((acc) => (
                                    <div key={acc.id} className="flex items-center justify-between gap-3 py-2">
                                      <span className="text-sm text-slate-600">
                                        {acc.username ? `@${acc.username}` : acc.name || acc.id}
                                      </span>
                                      <Button type="button" size="sm" onClick={() => handleConnect(acc)} disabled={isConnecting}>
                                        {t('instagramConnect.connectButton', 'Connect')}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </ModuleShellContentGate>
              </div>

              {showPageSkeleton && (
                <div
                  className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-surface-muted"
                  aria-busy
                  aria-label={t('instagramConnect.loadingAccounts', 'Loading...')}
                >
                  <span className="sr-only">{t('instagramConnect.loadingAccounts', 'Loading...')}</span>
                  <InstagramConnectPageSkeleton mode="overlay" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
