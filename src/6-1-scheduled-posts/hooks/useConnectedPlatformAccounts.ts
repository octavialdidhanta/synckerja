import { useMemo } from 'react';
import { useLinkedInContentSettings } from '@/linkedin-content/hooks/useLinkedInContentSettings';
import { missingLinkedInScopesForFeature } from '@/linkedin-content/constants/linkedinOAuthScopes';
import { useMetaContentConfig } from '@/meta-content/hooks/useMetaContentConfig';
import {
  facebookPublishScopesOk,
  instagramPublishScopesOk,
} from '@/meta-platform/constants/metaOAuthScopes';
import { useTikTokContentSettings } from '@/tiktok-content/hooks/useTikTokContentSettings';
import { getTikTokAccountDisplayLabel } from '@/tiktok-content/lib/tiktokAccountDisplayLabel';
import { useYouTubeContentSettings } from '@/youtube-content/hooks/useYouTubeContentSettings';
import { normalizeMetaPlatformKey } from '../lib/platformOAuthConfig';

export type ConnectedPlatformAccount = {
  platform: string;
  accountId: string;
  accountLabel: string;
  publishScopesOk: boolean;
  isActive: boolean;
};

export function useConnectedPlatformAccounts(organizationId: string | null | undefined) {
  const enabled = Boolean(organizationId);

  const tiktokSettings = useTikTokContentSettings(organizationId, { enabled });
  const youtubeSettings = useYouTubeContentSettings(organizationId, { enabled });
  const linkedinSettings = useLinkedInContentSettings(organizationId, { enabled });
  const metaConfig = useMetaContentConfig(organizationId);

  const accounts = useMemo((): ConnectedPlatformAccount[] => {
    const list: ConnectedPlatformAccount[] = [];

    for (const acc of tiktokSettings.data?.accounts ?? []) {
      if (!acc.is_active) continue;
      list.push({
        platform: 'TikTok',
        accountId: acc.open_id,
        accountLabel: getTikTokAccountDisplayLabel(acc),
        publishScopesOk: acc.publish_scopes_granted !== false,
        isActive: true,
      });
    }

    for (const acc of youtubeSettings.data?.accounts ?? []) {
      if (!acc.is_active) continue;
      list.push({
        platform: 'YouTube',
        accountId: acc.channel_id,
        accountLabel: acc.display_name || acc.label || acc.channel_id,
        publishScopesOk: acc.upload_scopes_granted !== false,
        isActive: true,
      });
    }

    for (const acc of linkedinSettings.data?.accounts ?? []) {
      if (!acc.is_active) continue;
      list.push({
        platform: 'LinkedIn',
        accountId: acc.page_id,
        accountLabel: acc.display_name || acc.label || acc.page_id,
        publishScopesOk:
          missingLinkedInScopesForFeature(
            Array.isArray(acc.granted_scopes) ? acc.granted_scopes : [],
            'publish',
          ).length === 0,
        isActive: true,
      });
    }

    for (const acc of metaConfig.data?.accounts ?? []) {
      const metaKey = normalizeMetaPlatformKey(acc.platform);
      if (!metaKey) continue;
      const platform = metaKey === 'instagram' ? 'Instagram' : 'Facebook';
      list.push({
        platform,
        accountId: acc.account_id,
        accountLabel: acc.account_label || acc.account_id,
        publishScopesOk:
          metaKey === 'instagram'
            ? instagramPublishScopesOk(acc.granted_scopes ?? [])
            : facebookPublishScopesOk(acc.granted_scopes ?? []),
        isActive: true,
      });
    }

    return list.sort((a, b) => {
      const platformOrder = a.platform.localeCompare(b.platform);
      if (platformOrder !== 0) return platformOrder;
      return a.accountLabel.localeCompare(b.accountLabel);
    });
  }, [tiktokSettings.data, youtubeSettings.data, linkedinSettings.data, metaConfig.data?.accounts]);

  const isLoading =
    tiktokSettings.isPending ||
    youtubeSettings.isPending ||
    linkedinSettings.isPending ||
    metaConfig.isPending;

  const getAccountsForPlatform = (platform: string): ConnectedPlatformAccount[] =>
    accounts.filter((acc) => acc.platform === platform.trim());

  const findAccount = (
    platform: string,
    accountId: string,
  ): ConnectedPlatformAccount | undefined =>
    accounts.find(
      (acc) => acc.platform === platform.trim() && acc.accountId === accountId.trim(),
    );

  return {
    accounts,
    isLoading,
    getAccountsForPlatform,
    findAccount,
  };
}
