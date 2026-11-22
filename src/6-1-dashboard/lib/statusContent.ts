export const STATUS_CONTENT_NONE = 'none';
export const STATUS_CONTENT_FOR_ADS = 'For Ads';

const FOR_ADS_WAITING_ON_TIME = new Set(['In Progress', 'Scheduled']);

const LEGACY_FOR_ADS = new Set(['Recomended For Ads', 'Recommended For Ads']);

/** Dropdown value. Older "Recomended For Ads" rows show as For Ads. */
export function normalizeStatusContent(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed === STATUS_CONTENT_NONE) return STATUS_CONTENT_NONE;
  if (trimmed === STATUS_CONTENT_FOR_ADS || LEGACY_FOR_ADS.has(trimmed)) return STATUS_CONTENT_FOR_ADS;
  return trimmed;
}

/** For Ads is not waiting to be posted, so In Progress and Scheduled stay blank. */
export function onTimeStatusForForAds(
  statusContent: string | null | undefined,
  onTime: string | null | undefined,
): string {
  const trimmed = (onTime ?? '').trim();
  if (
    normalizeStatusContent(statusContent) === STATUS_CONTENT_FOR_ADS &&
    FOR_ADS_WAITING_ON_TIME.has(trimmed)
  ) {
    return '';
  }
  return trimmed;
}
