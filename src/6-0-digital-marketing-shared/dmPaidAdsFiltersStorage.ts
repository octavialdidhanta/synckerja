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
  "calendar_year",
  "all_time",
  "last_n_days_today",
  "last_n_days_yesterday",
]);

export type MonthlyChartChannelFilter = "all" | "by_channel" | "google" | "meta" | "tiktok";

/** Report table + monthly charts service scope (`""` = all). */
export type ReportServiceFilterStored = string;

export type DmPaidAdsFiltersStored = {
  dateSelection: GoogleAdsDateRangeSelection;
  googleCustomerId: string;
  metaAdAccountId: string;
  tiktokAdvertiserId: string;
  reportChartYear: number;
  /** Report Spend/CPA/Leads charts: monthly breakdown for reportChartYear. */
  reportChartCompareEnabled: boolean;
  monthlyChartChannelFilter: MonthlyChartChannelFilter;
  reportServiceFilter: ReportServiceFilterStored;
};

type StoredJson = {
  preset?: string;
  rollingDays?: number;
  from?: string | null;
  to?: string | null;
  googleCustomerId?: string;
  metaAdAccountId?: string;
  tiktokAdvertiserId?: string;
  reportChartYear?: number;
  reportChartCompareEnabled?: boolean;
  calendarYear?: number;
  monthlyChartChannelFilter?: string;
  reportServiceFilter?: string;
};

const VALID_MONTHLY_CHART_CHANNEL: ReadonlySet<MonthlyChartChannelFilter> = new Set([
  "all",
  "by_channel",
  "google",
  "meta",
  "tiktok",
]);

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
    const calendarYear =
      preset === "calendar_year" &&
      typeof parsed.calendarYear === "number" &&
      parsed.calendarYear >= 2000 &&
      parsed.calendarYear <= 2100
        ? Math.floor(parsed.calendarYear)
        : undefined;
    const dateSelection: GoogleAdsDateRangeSelection = {
      preset,
      rollingDays,
      range: {
        from: from ?? fallback.range.from,
        to: to ?? fallback.range.to,
      },
      ...(calendarYear != null ? { calendarYear } : {}),
    };
    return {
      dateSelection,
      googleCustomerId: typeof parsed.googleCustomerId === "string" ? parsed.googleCustomerId : "",
      metaAdAccountId: typeof parsed.metaAdAccountId === "string" ? parsed.metaAdAccountId : "",
      tiktokAdvertiserId:
        typeof parsed.tiktokAdvertiserId === "string" ? parsed.tiktokAdvertiserId : "",
      reportChartYear:
        typeof parsed.reportChartYear === "number" &&
        parsed.reportChartYear >= 2000 &&
        parsed.reportChartYear <= 2100
          ? Math.floor(parsed.reportChartYear)
          : new Date().getFullYear(),
      reportChartCompareEnabled: parsed.reportChartCompareEnabled === true,
      monthlyChartChannelFilter:
        typeof parsed.monthlyChartChannelFilter === "string" &&
        VALID_MONTHLY_CHART_CHANNEL.has(
          parsed.monthlyChartChannelFilter as MonthlyChartChannelFilter,
        )
          ? (parsed.monthlyChartChannelFilter as MonthlyChartChannelFilter)
          : "all",
      reportServiceFilter:
        typeof parsed.reportServiceFilter === "string" ? parsed.reportServiceFilter : "",
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
      calendarYear: value.dateSelection.calendarYear,
      from: value.dateSelection.range.from?.toISOString() ?? null,
      to: value.dateSelection.range.to?.toISOString() ?? null,
      googleCustomerId: value.googleCustomerId,
      metaAdAccountId: value.metaAdAccountId,
      tiktokAdvertiserId: value.tiktokAdvertiserId,
      reportChartYear: value.reportChartYear,
      reportChartCompareEnabled: value.reportChartCompareEnabled,
      monthlyChartChannelFilter: value.monthlyChartChannelFilter,
      reportServiceFilter: value.reportServiceFilter,
    };
    sessionStorage.setItem(storageKey(organizationId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
