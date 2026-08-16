import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Facebook, Instagram, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { cn } from '@/shared/lib/utils';
import { useInstagramAccounts } from '@/5-3-whatsapp/hooks/useInstagramAccounts';
import { useFacebookPages } from '@/5-3-whatsapp/hooks/useFacebookPages';
import { notifyMetaOAuthExchangeWarnings } from '@/meta-platform/lib/notifyMetaOAuthExchangeResult';
import { useMetaOAuthConnect } from '@/meta-platform/hooks/useMetaOAuthConnect';
import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import type { MetaContentOAuthReturnPath } from '@/meta-content/settings/metaContentSettingsPaths';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export type MetaContentSettingsPanelProps = {
  platform: MetaContentPlatform;
  oauthReturnPath: MetaContentOAuthReturnPath;
  className?: string;
};

function instagramAccountLabel(row: {
  instagram_username: string | null;
  instagram_name: string | null;
  facebook_page_name?: string | null;
  facebook_page_id: string | null;
}): string {
  return (
    row.instagram_username?.trim() ||
    row.instagram_name?.trim() ||
    row.facebook_page_name?.trim() ||
    row.facebook_page_id ||
    'Meta account'
  );
}

export function MetaContentSettingsPanel({
  platform,
  oauthReturnPath,
  className,
}: MetaContentSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const [isDisconnectingFb, setIsDisconnectingFb] = useState(false);

  const {
    accounts: instagramAccounts,
    isLoading: instagramLoading,
    refetch: refetchInstagram,
    disconnectAccount: disconnectInstagramAccount,
    isDisconnecting: isDisconnectingInstagram,
  } = useInstagramAccounts();

  const {
    pages: facebookPages,
    isLoading: facebookLoading,
    refetch: refetchFacebook,
    disconnectPage: disconnectFacebookPage,
    isDisconnecting: isDisconnectingFacebookPages,
  } = useFacebookPages();

  const isLoading = platform === 'instagram' ? instagramLoading : facebookLoading;
  const connectedCount =
    platform === 'instagram' ? instagramAccounts.length : facebookPages.length;

  const PlatformIcon = platform === 'instagram' ? Instagram : Facebook;

  const showZeroAccountsWarning = () => {
    toast.warning(
      t('instagramConnect.zeroAccountsWarning', 'Login succeeded but no Instagram Business account was found.'),
      { duration: 10000 },
    );
  };

  const { startOAuth, oauthLoading, hasOAuth } = useMetaOAuthConnect({
    flow: platform,
    onExchangeComplete: async (resData) => {
      await refetchInstagram();
      await refetchFacebook();
      queryClient.invalidateQueries({ queryKey: ['meta-content-config', organizationId] });
      const synced = typeof resData.accounts_synced === 'number' ? resData.accounts_synced : 0;
      if (synced > 0) {
        toast.success(
          t('digitalMarketing.metaContent.connectedToast', 'Meta account connected successfully.'),
        );
      } else if (platform === 'instagram') {
        showZeroAccountsWarning();
      }
      notifyMetaOAuthExchangeWarnings(t, resData, { notifyWebhookPartial: false });
    },
  });

  useEffect(() => {
    const connected = searchParams.get('connected');
    const existing = searchParams.get('existing');
    const oauthError = searchParams.get('oauth_error');
    if (connected === '1') {
      if (existing === '1') {
        toast.info(
          t(
            'digitalMarketing.metaContent.reconnectedToast',
            'This Meta account is already connected. Log in with a different account to add another.',
          ),
        );
      } else {
        toast.success(
          t('digitalMarketing.metaContent.connectedToast', 'Meta account connected successfully.'),
        );
      }
      searchParams.delete('connected');
      searchParams.delete('existing');
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      toast.error(
        t('digitalMarketing.metaContent.oauthErrorToast', {
          message: oauthError,
          defaultValue: `Sign-in failed: ${oauthError}`,
        }),
      );
      searchParams.delete('oauth_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t]);

  const handleDisconnectInstagram = async (accountId: string) => {
    try {
      await disconnectInstagramAccount(accountId);
      await refetchInstagram();
      queryClient.invalidateQueries({ queryKey: ['meta-content-config', organizationId] });
      toast.success(t('digitalMarketing.metaContent.disconnectedToast', 'Account disconnected.'));
    } catch (e) {
      toast.error((e as Error)?.message ?? t('common.error', 'Error'));
    }
  };

  const handleDisconnectFacebook = async (pageRowId: string) => {
    if (!organizationId) return;
    setIsDisconnectingFb(true);
    try {
      await disconnectFacebookPage(pageRowId);
      await refetchFacebook();
      queryClient.invalidateQueries({ queryKey: ['meta-content-config', organizationId] });
      toast.success(t('digitalMarketing.metaContent.disconnectedToast', 'Account disconnected.'));
    } catch (e) {
      toast.error((e as Error)?.message ?? t('common.error', 'Error'));
    } finally {
      setIsDisconnectingFb(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-3 p-4', className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 overflow-y-auto p-4', className)}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {platform === 'instagram'
            ? t('digitalMarketing.metaContent.settingsTitleInstagram', 'Instagram Content')
            : t('digitalMarketing.metaContent.settingsTitleFacebook', 'Facebook Content')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'digitalMarketing.metaContent.settingsDesc',
            'Connect Meta Business accounts to pull organic insights, comments, and Page performance.',
          )}
        </p>
      </div>

      {!hasOAuth && (
        <Alert variant="destructive">
          <AlertTitle>{t('instagramConnect.oauthNotConfigured', 'VITE_META_APP_ID not set.')}</AlertTitle>
          <AlertDescription>
            {t(
              'digitalMarketing.metaContent.oauthNotConfiguredDesc',
              'Configure VITE_META_APP_ID in the app environment to enable Meta OAuth.',
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!hasOAuth || oauthLoading}
          onClick={() => void startOAuth()}
        >
          {oauthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {connectedCount > 0
            ? t('digitalMarketing.metaContent.connectAnother', 'Connect another account')
            : t('digitalMarketing.metaContent.connectAccount', 'Connect with Facebook')}
        </Button>
      </div>

      {platform === 'instagram' && instagramAccounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('digitalMarketing.metaContent.connectedAccounts', 'Connected accounts')}
          </p>
          {instagramAccounts.map((acc) => {
            const label = instagramAccountLabel(acc);
            return (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <PlatformIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{label}</p>
                    {acc.facebook_page_name && acc.instagram_username ? (
                      <p className="truncate text-xs text-muted-foreground">{acc.facebook_page_name}</p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('digitalMarketing.metaContent.removeAccount', 'Remove account')}
                  disabled={isDisconnectingInstagram}
                  onClick={() => void handleDisconnectInstagram(acc.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {platform === 'facebook' && facebookPages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('digitalMarketing.metaContent.connectedAccounts', 'Connected accounts')}
          </p>
          {facebookPages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <PlatformIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{page.page_name ?? page.facebook_page_id}</p>
                  <p className="truncate text-xs text-muted-foreground">{page.facebook_page_id}</p>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t('digitalMarketing.metaContent.removeAccount', 'Remove account')}
                disabled={isDisconnectingFb || isDisconnectingFacebookPages}
                onClick={() => void handleDisconnectFacebook(page.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input type="hidden" name="oauthReturnPath" value={oauthReturnPath} readOnly />
    </div>
  );
}
