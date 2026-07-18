import {
  defaultGoogleAdsDateSelection,
  type GoogleAdsDateRangeSelection,
} from '@/6-0-google-ads/lib/googleAdsDatePresets';

const STORAGE_PREFIX = 'synckerja.leadMagnet.listDateRange.v1';

function storageKey(organizationId: string): string {
  return `${STORAGE_PREFIX}:${organizationId}`;
}

export function readLeadMagnetListDateSelection(
  organizationId: string | null | undefined,
): GoogleAdsDateRangeSelection {
  if (!organizationId || typeof window === 'undefined') {
    return defaultGoogleAdsDateSelection();
  }
  try {
    const raw = window.localStorage.getItem(storageKey(organizationId));
    if (!raw) return defaultGoogleAdsDateSelection();
    const parsed = JSON.parse(raw) as GoogleAdsDateRangeSelection;
    if (!parsed?.preset || !parsed?.range?.from || !parsed?.range?.to) {
      return defaultGoogleAdsDateSelection();
    }
    return {
      ...parsed,
      range: {
        from: new Date(parsed.range.from),
        to: new Date(parsed.range.to),
      },
    };
  } catch {
    return defaultGoogleAdsDateSelection();
  }
}

export function writeLeadMagnetListDateSelection(
  organizationId: string | null | undefined,
  selection: GoogleAdsDateRangeSelection,
): void {
  if (!organizationId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(organizationId),
      JSON.stringify({
        ...selection,
        range: {
          from: selection.range.from.toISOString(),
          to: selection.range.to.toISOString(),
        },
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}
