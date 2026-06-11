import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  dateSelectionForCalendarYear,
  defaultGoogleAdsDateSelection,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  readDmPaidAdsFilters,
  writeDmPaidAdsFilters,
  type MonthlyChartChannelFilter,
  type ReportServiceFilterStored,
} from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";

export type DigitalMarketingPaidAdsFiltersContextValue = {
  dateSelection: GoogleAdsDateRangeSelection;
  setDateSelection: Dispatch<SetStateAction<GoogleAdsDateRangeSelection>>;
  /** Report monthly chart year — synced when date picker spans a single calendar year. */
  reportChartYear: number;
  /** Sets report/chart year via calendar-year preset in the date picker. */
  setReportChartYear: (year: number) => void;
  /** Report charts: monthly Jan–Dec for reportChartYear (Spend/CPA/Leads only). */
  reportChartCompareEnabled: boolean;
  setReportChartCompareEnabled: (enabled: boolean) => void;
  /** Shared channel filter for report monthly spend & CPA charts. */
  monthlyChartChannelFilter: MonthlyChartChannelFilter;
  setMonthlyChartChannelFilter: (filter: MonthlyChartChannelFilter) => void;
  /** Filters report table rows and monthly spend/CPA charts (`""` = all services). */
  reportServiceFilter: ReportServiceFilterStored;
  setReportServiceFilter: (filter: ReportServiceFilterStored) => void;
  googleCustomerId: string;
  setGoogleCustomerId: (customerId: string) => void;
  metaAdAccountId: string;
  setMetaAdAccountId: (adAccountId: string) => void;
  tiktokAdvertiserId: string;
  setTikTokAdvertiserId: (advertiserId: string) => void;
  filtersHydrated: boolean;
};

const DigitalMarketingPaidAdsFiltersContext =
  createContext<DigitalMarketingPaidAdsFiltersContextValue | null>(null);

export function useDigitalMarketingPaidAdsFilters(): DigitalMarketingPaidAdsFiltersContextValue {
  const ctx = useContext(DigitalMarketingPaidAdsFiltersContext);
  if (!ctx) {
    throw new Error(
      "useDigitalMarketingPaidAdsFilters must be used within DigitalMarketingPaidAdsProvider",
    );
  }
  return ctx;
}

function normalizeChartYear(year: number): number {
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return new Date().getFullYear();
  }
  return Math.floor(year);
}

export function DigitalMarketingPaidAdsProvider({ children }: { children: ReactNode }) {
  const { organizationId } = useCurrentOrg();
  const [dateSelection, setDateSelection] = useState<GoogleAdsDateRangeSelection>(() =>
    defaultGoogleAdsDateSelection(),
  );
  const [reportChartYear, setReportChartYearState] = useState(() =>
    new Date().getFullYear(),
  );
  const [reportChartCompareEnabled, setReportChartCompareEnabledState] = useState(false);
  const [monthlyChartChannelFilter, setMonthlyChartChannelFilterState] =
    useState<MonthlyChartChannelFilter>("all");
  const [reportServiceFilter, setReportServiceFilterState] = useState<ReportServiceFilterStored>("");
  const [googleCustomerId, setGoogleCustomerIdState] = useState("");
  const [metaAdAccountId, setMetaAdAccountIdState] = useState("");
  const [tiktokAdvertiserId, setTikTokAdvertiserIdState] = useState("");
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const hydratedOrgRef = useRef<string | null>(null);
  const persistSkipRef = useRef(true);

  useEffect(() => {
    if (!organizationId) {
      setFiltersHydrated(false);
      hydratedOrgRef.current = null;
      return;
    }
    if (hydratedOrgRef.current === organizationId) return;

    const stored = readDmPaidAdsFilters(organizationId);
    if (stored) {
      setDateSelection(stored.dateSelection);
      setGoogleCustomerIdState(stored.googleCustomerId);
      setMetaAdAccountIdState(stored.metaAdAccountId);
      setTikTokAdvertiserIdState(stored.tiktokAdvertiserId);
      setReportChartYearState(normalizeChartYear(stored.reportChartYear));
      setReportChartCompareEnabledState(stored.reportChartCompareEnabled);
      setMonthlyChartChannelFilterState(stored.monthlyChartChannelFilter);
      setReportServiceFilterState(stored.reportServiceFilter ?? "");
    } else {
      setDateSelection(defaultGoogleAdsDateSelection());
      setGoogleCustomerIdState("");
      setMetaAdAccountIdState("");
      setTikTokAdvertiserIdState("");
      setReportChartYearState(new Date().getFullYear());
      setReportChartCompareEnabledState(false);
      setMonthlyChartChannelFilterState("all");
      setReportServiceFilterState("");
    }

    hydratedOrgRef.current = organizationId;
    persistSkipRef.current = true;
    setFiltersHydrated(true);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !filtersHydrated || hydratedOrgRef.current !== organizationId) {
      return;
    }
    if (persistSkipRef.current) {
      persistSkipRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      writeDmPaidAdsFilters(organizationId, {
        dateSelection,
        googleCustomerId,
        metaAdAccountId,
        tiktokAdvertiserId,
        reportChartYear,
        reportChartCompareEnabled,
        monthlyChartChannelFilter,
        reportServiceFilter,
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    organizationId,
    filtersHydrated,
    dateSelection,
    googleCustomerId,
    metaAdAccountId,
    tiktokAdvertiserId,
    reportChartYear,
    reportChartCompareEnabled,
    monthlyChartChannelFilter,
    reportServiceFilter,
  ]);

  /** Compare monthly charts are not used with All time (aggregated Jan–Dec view). */
  useEffect(() => {
    if (!filtersHydrated) return;
    if (dateSelection.preset === "all_time") {
      setReportChartCompareEnabledState((current) => (current ? false : current));
    }
  }, [dateSelection.preset, filtersHydrated]);

  /** Keep chart year aligned with calendar-year preset or single-year custom range. */
  useEffect(() => {
    if (!filtersHydrated) return;
    if (
      (dateSelection.preset === "calendar_year" ||
        dateSelection.preset === "calendar_quarter") &&
      dateSelection.calendarYear != null
    ) {
      const y = normalizeChartYear(dateSelection.calendarYear);
      setReportChartYearState((current) => (current === y ? current : y));
      return;
    }
    const from = dateSelection.range.from;
    const to = dateSelection.range.to;
    if (!from || !to) return;
    if (from.getFullYear() === to.getFullYear()) {
      const y = normalizeChartYear(from.getFullYear());
      setReportChartYearState((current) => (current === y ? current : y));
    }
  }, [dateSelection, filtersHydrated]);

  const setGoogleCustomerId = useCallback((customerId: string) => {
    setGoogleCustomerIdState(customerId);
  }, []);

  const setMetaAdAccountId = useCallback((id: string) => {
    setMetaAdAccountIdState(id);
  }, []);

  const setTikTokAdvertiserId = useCallback((id: string) => {
    setTikTokAdvertiserIdState(id);
  }, []);

  const setReportChartYear = useCallback((year: number) => {
    const y = normalizeChartYear(year);
    setReportChartYearState(y);
    setDateSelection(dateSelectionForCalendarYear(y));
  }, []);

  const setMonthlyChartChannelFilter = useCallback((filter: MonthlyChartChannelFilter) => {
    setMonthlyChartChannelFilterState(filter);
  }, []);

  const setReportServiceFilter = useCallback((filter: ReportServiceFilterStored) => {
    setReportServiceFilterState(filter);
  }, []);

  const setReportChartCompareEnabled = useCallback((enabled: boolean) => {
    setReportChartCompareEnabledState(enabled);
  }, []);

  const value = useMemo(
    (): DigitalMarketingPaidAdsFiltersContextValue => ({
      dateSelection,
      setDateSelection,
      reportChartYear,
      setReportChartYear,
      reportChartCompareEnabled,
      setReportChartCompareEnabled,
      monthlyChartChannelFilter,
      setMonthlyChartChannelFilter,
      reportServiceFilter,
      setReportServiceFilter,
      googleCustomerId,
      setGoogleCustomerId,
      metaAdAccountId,
      setMetaAdAccountId,
      tiktokAdvertiserId,
      setTikTokAdvertiserId,
      filtersHydrated,
    }),
    [
      dateSelection,
      reportChartYear,
      reportChartCompareEnabled,
      monthlyChartChannelFilter,
      reportServiceFilter,
      googleCustomerId,
      metaAdAccountId,
      tiktokAdvertiserId,
      filtersHydrated,
      setGoogleCustomerId,
      setMetaAdAccountId,
      setTikTokAdvertiserId,
      setReportChartYear,
      setReportChartCompareEnabled,
      setMonthlyChartChannelFilter,
      setReportServiceFilter,
    ],
  );

  return (
    <DigitalMarketingPaidAdsFiltersContext.Provider value={value}>
      {children}
    </DigitalMarketingPaidAdsFiltersContext.Provider>
  );
}
