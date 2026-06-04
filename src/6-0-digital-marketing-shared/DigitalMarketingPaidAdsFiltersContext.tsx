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
} from "@/6-0-digital-marketing-shared/dmPaidAdsFiltersStorage";

export type DigitalMarketingPaidAdsFiltersContextValue = {
  dateSelection: GoogleAdsDateRangeSelection;
  setDateSelection: Dispatch<SetStateAction<GoogleAdsDateRangeSelection>>;
  /** Report monthly chart year — synced when date picker spans a single calendar year. */
  reportChartYear: number;
  /** Sets chart year and expands the shared date picker to that calendar year. */
  setReportChartYear: (year: number) => void;
  googleCustomerId: string;
  setGoogleCustomerId: (customerId: string) => void;
  metaAdAccountId: string;
  setMetaAdAccountId: (adAccountId: string) => void;
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
  const [googleCustomerId, setGoogleCustomerIdState] = useState("");
  const [metaAdAccountId, setMetaAdAccountIdState] = useState("");
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
      setReportChartYearState(normalizeChartYear(stored.reportChartYear));
    } else {
      setDateSelection(defaultGoogleAdsDateSelection());
      setGoogleCustomerIdState("");
      setMetaAdAccountIdState("");
      setReportChartYearState(new Date().getFullYear());
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
        reportChartYear,
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [
    organizationId,
    filtersHydrated,
    dateSelection,
    googleCustomerId,
    metaAdAccountId,
    reportChartYear,
  ]);

  /** Keep chart year aligned when the date picker covers a single calendar year. */
  useEffect(() => {
    if (!filtersHydrated) return;
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

  const setReportChartYear = useCallback((year: number) => {
    const y = normalizeChartYear(year);
    setReportChartYearState(y);
    setDateSelection(dateSelectionForCalendarYear(y));
  }, []);

  const value = useMemo(
    (): DigitalMarketingPaidAdsFiltersContextValue => ({
      dateSelection,
      setDateSelection,
      reportChartYear,
      setReportChartYear,
      googleCustomerId,
      setGoogleCustomerId,
      metaAdAccountId,
      setMetaAdAccountId,
      filtersHydrated,
    }),
    [
      dateSelection,
      reportChartYear,
      googleCustomerId,
      metaAdAccountId,
      filtersHydrated,
      setGoogleCustomerId,
      setMetaAdAccountId,
      setReportChartYear,
    ],
  );

  return (
    <DigitalMarketingPaidAdsFiltersContext.Provider value={value}>
      {children}
    </DigitalMarketingPaidAdsFiltersContext.Provider>
  );
}
