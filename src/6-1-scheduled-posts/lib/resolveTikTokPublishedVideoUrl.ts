import type { ScheduledPost } from '../types/scheduled-post';

type LinkLike = {
  platform: string;
  url: string | null;
  platform_account_open_id?: string | null;
  external_post_id?: string | null;
};

function isHttpUrl(value: string | null | undefined): value is string {
  const url = value?.trim() ?? '';
  return url.startsWith('http://') || url.startsWith('https://');
}

/** Best-effort TikTok video URL for manual delete (API cannot delete published posts). */
export function resolveTikTokPublishedVideoUrl(args: {
  accountId: string;
  schedule: ScheduledPost | null | undefined;
  links: LinkLike[];
}): string | null {
  const accountId = args.accountId.trim();

  if (isHttpUrl(args.schedule?.published_url)) {
    return args.schedule!.published_url!.trim();
  }

  const matchingLinks = args.links.filter((link) => {
    if (link.platform !== 'TikTok' || !isHttpUrl(link.url)) return false;
    const openId = link.platform_account_open_id?.trim();
    return !openId || openId === accountId;
  });

  for (const link of matchingLinks) {
    if (isHttpUrl(link.url)) return link.url.trim();
  }

  const postId =
    String(args.schedule?.external_post_id ?? '').trim()
    || matchingLinks.map((l) => String(l.external_post_id ?? '').trim()).find(Boolean)
    || '';

  if (postId && !postId.startsWith('v_pub_')) {
    return `https://www.tiktok.com/video/${postId}`;
  }

  return null;
}
