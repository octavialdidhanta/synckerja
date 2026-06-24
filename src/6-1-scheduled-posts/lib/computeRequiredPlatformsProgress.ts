import type { ScheduledPost } from '../types/scheduled-post';
import {
  pickAccountScheduleForModal,
  pickPlatformScheduleForModal,
} from './pickPlatformScheduleDisplay';

export type RequiredPlatformInput = {
  id?: string;
  platform: string;
  is_active?: boolean | null;
  social_media_name?: { name: string } | null;
  custom_platform_name?: string | null;
  platform_account_id?: string | null;
  platform_account_label?: string | null;
};

export type SocialMediaLinkInput = {
  platform: string;
  url: string | null;
  social_media_name?: string | null;
  platform_account_open_id?: string | null;
  created_at?: string | null;
};

export type RequiredPlatformItemStatus =
  | 'missing'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'link_ready';

export type RequiredPlatformProgressItem = {
  key: string;
  label: string;
  platform: string;
  status: RequiredPlatformItemStatus;
  url?: string | null;
  completedAtIso?: string | null;
};

export function filterRequiredPlatformsForContentType(
  required: RequiredPlatformInput[],
  contentTypeName: string | null | undefined,
): RequiredPlatformInput[] {
  const active = required.filter((rp) => rp.is_active !== false);
  const contentType = String(contentTypeName ?? '').trim();
  if (contentType === 'Carousel' || contentType === 'Post') {
    return active.filter((rp) => rp.platform !== 'YouTube' && rp.platform !== 'Shopee');
  }
  return active;
}

function isValidLink(link: SocialMediaLinkInput): boolean {
  const url = link.url?.trim() ?? '';
  const platform = link.platform?.trim() ?? '';
  return Boolean(platform && url.startsWith('http'));
}

function requiredPlatformLabel(rp: RequiredPlatformInput): string {
  const base = rp.platform.trim();
  if (rp.social_media_name?.name) return `${base} · ${rp.social_media_name.name}`;
  if (rp.platform_account_label?.trim()) return `${base} · ${rp.platform_account_label.trim()}`;
  if (rp.custom_platform_name?.trim()) return `${base} · ${rp.custom_platform_name.trim()}`;
  return base;
}

function findLinkForRequired(
  links: SocialMediaLinkInput[],
  platform: string,
  accountId?: string | null,
): SocialMediaLinkInput | null {
  const platformTrim = platform.trim();
  const valid = links.filter((link) => link.platform?.trim() === platformTrim && isValidLink(link));
  if (!valid.length) return null;

  const accountTrim = accountId?.trim();
  if (accountTrim) {
    const byAccount = valid.find(
      (link) => link.platform_account_open_id?.trim() === accountTrim,
    );
    if (byAccount) return byAccount;
  }

  return valid[0];
}

export function computeRequiredPlatformProgressItems(
  requiredPlatforms: RequiredPlatformInput[],
  links: SocialMediaLinkInput[],
  contentTypeName: string | null | undefined,
  schedules: ScheduledPost[] = [],
): RequiredPlatformProgressItem[] {
  const activeRequired = filterRequiredPlatformsForContentType(requiredPlatforms, contentTypeName);

  return activeRequired.map((rp, index) => {
    const accountId = rp.platform_account_id?.trim() || null;
    const schedule = accountId
      ? pickAccountScheduleForModal(schedules, rp.platform, accountId)
      : pickPlatformScheduleForModal(schedules, rp.platform);
    const link = findLinkForRequired(links, rp.platform, accountId);
    const key = rp.id ?? `${rp.platform}-${accountId ?? index}`;

    let status: RequiredPlatformItemStatus = 'missing';
    let url: string | null | undefined;
    let completedAtIso: string | null = null;

    if (schedule?.status === 'published') {
      status = 'published';
      url = schedule.published_url;
      completedAtIso = schedule.published_at ?? schedule.created_at ?? null;
    } else if (schedule?.status === 'publishing') {
      status = 'publishing';
    } else if (schedule?.status === 'pending') {
      status = 'scheduled';
    } else if (schedule?.status === 'failed') {
      status = 'failed';
    } else if (link && isValidLink(link)) {
      status = 'link_ready';
      url = link.url;
      completedAtIso = link.created_at ?? null;
    }

    if ((status === 'published' || status === 'link_ready') && !url && link?.url) {
      url = link.url;
    }

    return {
      key,
      label: requiredPlatformLabel(rp),
      platform: rp.platform,
      status,
      url,
      completedAtIso,
    };
  });
}

function isFilledItemStatus(status: RequiredPlatformItemStatus): boolean {
  return status === 'published' || status === 'link_ready';
}

export function computePlanDoneState(
  requiredPlatforms: RequiredPlatformInput[],
  links: SocialMediaLinkInput[],
  contentTypeName: string | null | undefined,
  schedules: ScheduledPost[] = [],
): boolean {
  const activeRequired = filterRequiredPlatformsForContentType(requiredPlatforms, contentTypeName);

  if (activeRequired.length > 0) {
    const items = computeRequiredPlatformProgressItems(
      requiredPlatforms,
      links,
      contentTypeName,
      schedules,
    );
    return items.every((item) => isFilledItemStatus(item.status));
  }

  return links.filter(isValidLink).length >= 1;
}

export function computeRequiredPlatformsProgress(
  requiredPlatforms: RequiredPlatformInput[],
  links: SocialMediaLinkInput[],
  contentTypeName: string | null | undefined,
  schedules: ScheduledPost[] = [],
): {
  totalRequired: number;
  filledRequired: number;
  missingPlatforms: string[];
  isValid: boolean;
  progress: number;
  items: RequiredPlatformProgressItem[];
  hasPublishing: boolean;
} {
  const items = computeRequiredPlatformProgressItems(
    requiredPlatforms,
    links,
    contentTypeName,
    schedules,
  );

  const filledRequired = items.filter((item) => isFilledItemStatus(item.status)).length;
  const hasPublishing = items.some((item) => item.status === 'publishing');
  const missingPlatforms = items
    .filter((item) => item.status === 'missing' || item.status === 'failed')
    .map((item) => item.label);

  const totalRequired = items.length;
  let progress =
    totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 100;

  if (hasPublishing && progress < 100) {
    const inFlight = items.filter(
      (item) => item.status === 'publishing' || item.status === 'scheduled',
    ).length;
    progress = Math.min(
      99,
      Math.round(((filledRequired + inFlight * 0.35) / totalRequired) * 100),
    );
  }

  return {
    totalRequired,
    filledRequired,
    missingPlatforms,
    isValid: missingPlatforms.length === 0 && filledRequired === totalRequired,
    progress,
    items,
    hasPublishing,
  };
}
