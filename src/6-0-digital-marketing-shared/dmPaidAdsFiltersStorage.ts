import {
  defaultGoogleAdsDateSelection,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";

const STORAGE_KEY_PREFIX = "synckerja:dm-paid-ads-filters:";

const VALID_PRESETS = new Set<GoogleAdsDatePresetId>([
  "custom",
  "today",
  "yesterday",
  "this_week_mon_today",
  "last_7_days",
  "last_week_mon_sun",
  "last_14_days",
  "this_month",
  "last_30_days",
  "last_month",
  "all_time",
  "last_n_days_today",
  "last_n_days_yesterday",
]);

export type DmPaidAdsFiltersStored = {
  dateSelection: GoogleAdsDateRangeSelection;
  googleCustomerId: string;
  metaAdAccountId: string;
  reportChartYear: number;
};

type StoredJson = {
  preset?: string;
  rollingDays?: number;
  from?: string | null;
  to?: string | null;
  googleCustomerId?: string;
  metaAdAccountId?: string;
  reportChartYear?: number;
};

function storageKey(organizationId: string): string {
  return `${STORAGE_KEY_PREFIX}${organizationId}`;
}

function parseDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function readDmPaidAdsFilters(organizationId: string): DmPaidAdsFiltersStored | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(organizationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredJson;
    const preset = VALID_PRESETS.has(parsed.preset as GoogleAdsDatePresetId)
      ? (parsed.preset as GoogleAdsDatePresetId)
      : "last_30_days";
    const from = parseDate(parsed.from);
    const to = parseDate(parsed.to);
    const rollingDays =
      typeof parsed.rollingDays === "number" && parsed.rollingDays >= 1
        ? Math.min(999, Math.floor(parsed.rollingDays))
        : 30;
    const fallback = defaultGoogleAdsDateSelection();
    const dateSelection: GoogleAdsDateRangeSelection = {
      preset,
      rollingDays,
      range: {
        from: from ?? fallback.range.from,
        to: to ?? fallback.range.to,
      },
    };
    return {
      dateSelection,
      googleCustomerId: typeof parsed.googleCustomerId === "string" ? parsed.googleCustomerId : "",
      metaAdAccountId: typeof parsed.metaAdAccountId === "string" ? parsed.metaAdAccountId : "",
      reportChartYear:
        typeof parsed.reportChartYear === "number" &&
        parsed.reportChartYear >= 2000 &&
        parsed.reportChartYear <= 2100
          ? Math.floor(parsed.reportChartYear)
          : new Date().getFullYear(),
    };
  } catch {
    return null;
  }
}

export function writeDmPaidAdsFilters(
  organizationId: string,
  value: DmPaidAdsFiltersStored,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: StoredJson = {
      preset: value.dateSelection.preset,
      rollingDays: value.dateSelection.rollingDays,
      from: value.dateSelection.range.from?.toISOString() ?? null,
      to: value.dateSelection.range.to?.toISOString() ?? null,
      googleCustomerId: value.googleCustomerId,
      metaAdAccountId: value.metaAdAccountId,
      reportChartYear: value.reportChartYear,
    };
    sessionStorage.setItem(storageKey(organizationId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
