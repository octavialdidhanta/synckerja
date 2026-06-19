import { useMemo } from "react";
import {
  INSIGHT_TARGET_PLATFORMS,
  type InsightTargetAccountRef,
  type InsightTargetPlatform,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useLinkedInContentSettings } from "@/linkedin-content/hooks/useLinkedInContentSettings";
import { useTikTokContentSettings } from "@/tiktok-content/hooks/useTikTokContentSettings";
import { getTikTokAccountDisplayLabel } from "@/tiktok-content/lib/tiktokAccountDisplayLabel";
import { useYouTubeContentSettings } from "@/youtube-content/hooks/useYouTubeContentSettings";
import { useMetaContentConfig } from "@/meta-content/hooks/useMetaContentConfig";
import { useThreadsContentSettings } from "@/threads-content/hooks/useThreadsContentSettings";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export function useSocialMediaInsightTargetAccounts() {
  const { organizationId } = useCurrentOrg();

  const tiktokSettings = useTikTokContentSettings(organizationId, {
    enabled: Boolean(organizationId),
  });
  const youtubeSettings = useYouTubeContentSettings(organizationId, {
    enabled: Boolean(organizationId),
  });
  const linkedinSettings = useLinkedInContentSettings(organizationId, {
    enabled: Boolean(organizationId),
  });
  const metaConfig = useMetaContentConfig(organizationId);
  const threadsSettings = useThreadsContentSettings(organizationId);

  const accounts = useMemo((): InsightTargetAccountRef[] => {
    const list: InsightTargetAccountRef[] = [];
    const tt = tiktokSettings.data;
    const yt = youtubeSettings.data;
    const li = linkedinSettings.data;

    if (tt?.oauthConnected) {
      for (const acc of tt.accounts.filter((a) => a.is_active)) {
        list.push({
          platform: "tiktok",
          accountId: acc.open_id,
          accountLabel: getTikTokAccountDisplayLabel(acc),
          avatarUrl: acc.avatar_url,
        });
      }
    }
    if (yt?.oauthConnected) {
      for (const acc of yt.accounts.filter((a) => a.is_active)) {
        list.push({
          platform: "youtube",
          accountId: acc.channel_id,
          accountLabel: acc.label || acc.display_name || acc.channel_id,
          avatarUrl: acc.thumbnail_url,
        });
      }
    }
    if (li?.oauthConnected) {
      for (const acc of li.accounts.filter((a) => a.is_active)) {
        list.push({
          platform: "linkedin",
          accountId: acc.page_id,
          accountLabel: acc.label || acc.display_name || acc.page_id,
          avatarUrl: acc.thumbnail_url,
        });
      }
    }
    for (const acc of metaConfig.data?.accounts ?? []) {
      list.push({
        platform: acc.platform,
        accountId: acc.account_id,
        accountLabel: acc.account_label,
        avatarUrl: acc.avatar_url,
      });
    }
    if (threadsSettings.data?.oauthConnected) {
      for (const acc of threadsSettings.data.accounts) {
        list.push({
          platform: "threads",
          accountId: acc.account_id,
          accountLabel: acc.account_label,
          avatarUrl: acc.avatar_url,
        });
      }
    }

    return list.sort((a, b) => {
      const platformOrder =
        INSIGHT_TARGET_PLATFORMS.indexOf(a.platform) -
        INSIGHT_TARGET_PLATFORMS.indexOf(b.platform);
      if (platformOrder !== 0) return platformOrder;
      return a.accountLabel.localeCompare(b.accountLabel);
    });
  }, [tiktokSettings.data, youtubeSettings.data, linkedinSettings.data, threadsSettings.data, metaConfig.data?.accounts]);

  const accountsByPlatform = useMemo(() => {
    return INSIGHT_TARGET_PLATFORMS.reduce(
      (acc, platform) => {
        acc[platform] = accounts.filter((a) => a.platform === platform);
        return acc;
      },
      {} as Record<InsightTargetPlatform, InsightTargetAccountRef[]>,
    );
  }, [accounts]);

  const isLoading =
    tiktokSettings.isPending || youtubeSettings.isPending || linkedinSettings.isPending ||
    threadsSettings.isPending || metaConfig.isPending;

  return { accounts, accountsByPlatform, isLoading };
}
