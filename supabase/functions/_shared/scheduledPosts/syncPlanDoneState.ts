import {
  pickAccountScheduleForModal,
  pickPlatformScheduleForModal,
  type ScheduleRow,
} from "./pickPlatformScheduleServer.ts";

export type RequiredPlatformRow = {
  id?: string;
  platform: string;
  is_active?: boolean | null;
  platform_account_id?: string | null;
  platform_account_label?: string | null;
  custom_platform_name?: string | null;
};

export type SocialMediaLinkRow = {
  platform: string;
  url: string | null;
  platform_account_open_id?: string | null;
  created_at?: string | null;
};

export type RequiredPlatformItemStatus =
  | "missing"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "link_ready";

export type RequiredPlatformProgressItem = {
  key: string;
  label: string;
  platform: string;
  status: RequiredPlatformItemStatus;
  completedAtIso: string | null;
};

export function filterRequiredPlatformsForContentType(
  required: RequiredPlatformRow[],
  contentTypeName: string | null | undefined,
): RequiredPlatformRow[] {
  const active = required.filter((rp) => rp.is_active !== false);
  const contentType = String(contentTypeName ?? "").trim();
  if (contentType === "Carousel" || contentType === "Post") {
    return active.filter((rp) => rp.platform !== "YouTube" && rp.platform !== "Shopee");
  }
  return active;
}

function isValidLink(link: SocialMediaLinkRow): boolean {
  const url = link.url?.trim() ?? "";
  const platform = link.platform?.trim() ?? "";
  return Boolean(platform && url.startsWith("http"));
}

function requiredPlatformLabel(rp: RequiredPlatformRow): string {
  const base = rp.platform.trim();
  if (rp.platform_account_label?.trim()) return `${base} · ${rp.platform_account_label.trim()}`;
  if (rp.custom_platform_name?.trim()) return `${base} · ${rp.custom_platform_name.trim()}`;
  return base;
}

function findLinkForRequired(
  links: SocialMediaLinkRow[],
  platform: string,
  accountId?: string | null,
): SocialMediaLinkRow | null {
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
  requiredPlatforms: RequiredPlatformRow[],
  links: SocialMediaLinkRow[],
  contentTypeName: string | null | undefined,
  schedules: ScheduleRow[] = [],
): RequiredPlatformProgressItem[] {
  const activeRequired = filterRequiredPlatformsForContentType(requiredPlatforms, contentTypeName);

  return activeRequired.map((rp, index) => {
    const accountId = rp.platform_account_id?.trim() || null;
    const schedule = accountId
      ? pickAccountScheduleForModal(schedules, rp.platform, accountId)
      : pickPlatformScheduleForModal(schedules, rp.platform);
    const link = findLinkForRequired(links, rp.platform, accountId);
    const key = rp.id ?? `${rp.platform}-${accountId ?? index}`;

    let status: RequiredPlatformItemStatus = "missing";
    let completedAtIso: string | null = null;

    if (schedule?.status === "published") {
      status = "published";
      completedAtIso = schedule.published_at ?? schedule.created_at ?? null;
    } else if (schedule?.status === "publishing") {
      status = "publishing";
    } else if (schedule?.status === "pending") {
      status = "scheduled";
    } else if (schedule?.status === "failed") {
      status = "failed";
    } else if (link && isValidLink(link)) {
      status = "link_ready";
      completedAtIso = link.created_at ?? null;
    }

    return {
      key,
      label: requiredPlatformLabel(rp),
      platform: rp.platform,
      status,
      completedAtIso,
    };
  });
}

function isFilledItemStatus(status: RequiredPlatformItemStatus): boolean {
  return status === "published" || status === "link_ready";
}

export function computePlanDoneState(
  requiredPlatforms: RequiredPlatformRow[],
  links: SocialMediaLinkRow[],
  contentTypeName: string | null | undefined,
  schedules: ScheduleRow[] = [],
): boolean {
  const activeRequired = filterRequiredPlatformsForContentType(requiredPlatforms, contentTypeName);

  if (activeRequired.length > 0) {
    const items = computeRequiredPlatformProgressItems(
      requiredPlatforms,
      links,
      contentTypeName,
      schedules,
    );
    return items.length > 0 && items.every((item) => isFilledItemStatus(item.status));
  }

  return links.filter(isValidLink).length >= 1;
}

export const ON_TIME_IN_PROGRESS = "In Progress";
export const ON_TIME_SCHEDULED = "Scheduled";

export function derivePlanPostMetadata(
  items: RequiredPlatformProgressItem[],
  links: SocialMediaLinkRow[],
  postDateIso: string | null,
  hasRequiredPlatforms: boolean,
  calculateOnTimeStatus: (actual: string | null, planned: string | null) => string,
): { actual_post_date: string | null; on_time_status: string } {
  if (!hasRequiredPlatforms) {
    const validLinks = links.filter(isValidLink);
    if (validLinks.length === 0) {
      return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
    }
    const dates = validLinks
      .map((l) => l.created_at)
      .filter(Boolean) as string[];
    const earliest = dates.length > 0
      ? dates.sort()[0]
      : new Date().toISOString();
    const actualDate = earliest.split("T")[0];
    return {
      actual_post_date: actualDate,
      on_time_status: calculateOnTimeStatus(actualDate, postDateIso) || ON_TIME_IN_PROGRESS,
    };
  }

  if (items.length === 0) {
    return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
  }

  const hasFailed = items.some((item) => item.status === "failed");
  const allComplete = items.every((item) => isFilledItemStatus(item.status));
  const allScheduledOnly = items.every((item) => item.status === "scheduled");

  if (allComplete && !hasFailed) {
    const completionDates = items
      .map((item) => item.completedAtIso)
      .filter(Boolean) as string[];
    const latestIso = completionDates.length > 0
      ? completionDates.sort().at(-1)!
      : new Date().toISOString();
    const actualDate = latestIso.split("T")[0];
    return {
      actual_post_date: actualDate,
      on_time_status: calculateOnTimeStatus(actualDate, postDateIso) || ON_TIME_IN_PROGRESS,
    };
  }

  if (allScheduledOnly) {
    return { actual_post_date: null, on_time_status: ON_TIME_SCHEDULED };
  }

  return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
}
