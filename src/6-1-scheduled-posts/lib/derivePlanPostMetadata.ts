import type {
  RequiredPlatformItemStatus,
  RequiredPlatformProgressItem,
  SocialMediaLinkInput,
} from './computeRequiredPlatformsProgress';
import { calculateOnTimeStatus, calendarDayYmd } from './onTimeStatus';

export const ON_TIME_IN_PROGRESS = 'In Progress';
export const ON_TIME_SCHEDULED = 'Scheduled';

export { calculateOnTimeStatus as calculateOnTimeStatusClient } from './onTimeStatus';

/** True only when all required platforms are complete and post metadata reflects a finished publish. */
export function isPostMetricComplete(plan: {
  done?: boolean | null;
  actual_post_date?: string | null;
  on_time_status?: string | null;
}): boolean {
  if (plan.done !== true) return false;
  if (!plan.actual_post_date) return false;
  const onTime = String(plan.on_time_status ?? '').trim();
  if (!onTime || onTime === ON_TIME_IN_PROGRESS || onTime === ON_TIME_SCHEDULED) return false;
  return onTime === 'Ontime' || onTime.startsWith('Late ');
}

function isValidLink(link: SocialMediaLinkInput): boolean {
  const url = link.url?.trim() ?? '';
  const platform = link.platform?.trim() ?? '';
  return Boolean(platform && url.startsWith('http'));
}

function isFilledItemStatus(status: RequiredPlatformItemStatus): boolean {
  return status === 'published' || status === 'link_ready';
}

function actualDateFromIso(iso: string): string {
  return calendarDayYmd(iso) ?? iso.slice(0, 10);
}

export function derivePlanPostMetadataClient(
  items: RequiredPlatformProgressItem[],
  links: SocialMediaLinkInput[],
  postDateIso: string | null,
  hasRequiredPlatforms: boolean,
): { actual_post_date: string | null; on_time_status: string } {
  if (!hasRequiredPlatforms) {
    const validLinks = links.filter(isValidLink);
    if (validLinks.length === 0) {
      return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
    }
    const dates = validLinks
      .map((l) => l.created_at)
      .filter(Boolean) as string[];
    const earliest = dates.length > 0 ? dates.sort()[0] : new Date().toISOString();
    const actualDate = actualDateFromIso(earliest);
    return {
      actual_post_date: actualDate,
      on_time_status: calculateOnTimeStatus(actualDate, postDateIso) || ON_TIME_IN_PROGRESS,
    };
  }

  if (items.length === 0) {
    return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
  }

  const hasFailed = items.some((item) => item.status === 'failed');
  const allComplete = items.every((item) => isFilledItemStatus(item.status));
  const allScheduledOnly = items.every((item) => item.status === 'scheduled');

  if (allComplete && !hasFailed) {
    const completionDates = items
      .map((item) => item.completedAtIso)
      .filter(Boolean) as string[];
    const latestIso = completionDates.length > 0
      ? completionDates.sort().at(-1)!
      : new Date().toISOString();
    const actualDate = actualDateFromIso(latestIso);
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
