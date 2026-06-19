import {
  buildPlatformPlaceholderRow,
  normalizeLinkedInMetrics,
  normalizeMetaMetrics,
  normalizeThreadsMetrics,
  normalizeTikTokMetrics,
  normalizeYouTubeMetrics,
} from "@/6-0-social-media-performance-shared/socialMediaInsightNormalize";
import type { InsightTargetAccountRef } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SocialMediaInsightAccountRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import { fetchLinkedInContentPosts } from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";
import { fetchThreadsContentMetrics } from "@/threads-content/hooks/useThreadsContentMetrics";
import { fetchMetaContentMetrics } from "@/meta-content/hooks/useMetaContentMetrics";
import { fetchTikTokContentVideos } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import { fetchYouTubeContentVideos } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";

export const INSIGHT_FETCH_CONCURRENCY = 4;

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchInsightAccountMetrics(
  organizationId: string,
  account: InsightTargetAccountRef,
  dateStart: string,
  dateEnd: string,
): Promise<SocialMediaInsightAccountRow> {
  try {
    if (account.platform === "tiktok") {
      const payload = await fetchTikTokContentVideos({
        organizationId,
        openId: account.accountId,
        dateStart,
        dateEnd,
        forceRefresh: false,
      });
      return normalizeTikTokMetrics(payload, account.avatarUrl).account;
    }
    if (account.platform === "youtube") {
      const payload = await fetchYouTubeContentVideos({
        organizationId,
        channelId: account.accountId,
        dateStart,
        dateEnd,
        forceRefresh: false,
      });
      return normalizeYouTubeMetrics(payload, account.avatarUrl).account;
    }
    if (account.platform === "instagram" || account.platform === "facebook") {
      const payload = await fetchMetaContentMetrics({
        organizationId,
        platform: account.platform,
        accountId: account.accountId,
        dateStart,
        dateEnd,
      });
      return normalizeMetaMetrics(payload, account.avatarUrl).account;
    }
    if (account.platform === "linkedin") {
      const payload = await fetchLinkedInContentPosts({
        organizationId,
        pageId: account.accountId,
        dateStart,
        dateEnd,
        forceRefresh: false,
      });
      return normalizeLinkedInMetrics(payload, account.avatarUrl).account;
    }
    if (account.platform === "threads") {
      const payload = await fetchThreadsContentMetrics({
        organizationId,
        accountId: account.accountId,
        dateStart,
        dateEnd,
      });
      return normalizeThreadsMetrics(payload, account.avatarUrl).account;
    }
    throw new Error(`Unsupported platform: ${account.platform}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const placeholder = buildPlatformPlaceholderRow(account.platform);
    return {
      ...placeholder,
      accountId: account.accountId,
      connected: true,
      loading: false,
      error: msg,
      isPlatformPlaceholder: false,
      avatarUrl: account.avatarUrl,
    };
  }
}
