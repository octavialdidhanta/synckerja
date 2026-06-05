import { createContext, useContext, type ReactNode } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useDigitalMarketingReportCosts } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportMonthlySpend } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";

type ReportCostsValue = ReturnType<typeof useDigitalMarketingReportCosts>;
type ReportMonthlySpendValue = ReturnType<typeof useDigitalMarketingReportMonthlySpend>;

export type DigitalMarketingReportDataContextValue = ReportCostsValue & {
  monthlySpend: ReportMonthlySpendValue;
};

const DigitalMarketingReportDataContext =
  createContext<DigitalMarketingReportDataContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  /** Defer monthly chart queries until table phase is ready (or section is visible). */
  chartsEnabled?: boolean;
};

export function DigitalMarketingReportDataProvider({
  children,
  chartsEnabled = true,
}: ProviderProps) {
  const costs = useDigitalMarketingReportCosts();
  const { reportChartYear } = useDigitalMarketingPaidAdsFilters();
  const monthlySpend = useDigitalMarketingReportMonthlySpend(reportChartYear, {
    forChartsCompare: true,
    enabled: chartsEnabled,
  });

  return (
    <DigitalMarketingReportDataContext.Provider value={{ ...costs, monthlySpend }}>
      {children}
    </DigitalMarketingReportDataContext.Provider>
  );
}

export function useDigitalMarketingReportData(): DigitalMarketingReportDataContextValue {
  const ctx = useContext(DigitalMarketingReportDataContext);
  if (!ctx) {
    throw new Error(
      "useDigitalMarketingReportData must be used within DigitalMarketingReportDataProvider",
    );
  }
  return ctx;
}
