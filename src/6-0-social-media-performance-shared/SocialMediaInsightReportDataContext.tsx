import { createContext, useContext, type ReactNode } from "react";
import { useSocialMediaInsightReportData } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightReportData";
import type { SocialMediaPlatformFilter } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type SocialMediaInsightReportDataContextValue = ReturnType<
  typeof useSocialMediaInsightReportData
>;

const SocialMediaInsightReportDataContext =
  createContext<SocialMediaInsightReportDataContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  platformFilter: SocialMediaPlatformFilter;
  chartsEnabled?: boolean;
};

export function SocialMediaInsightReportDataProvider({
  children,
  platformFilter,
  chartsEnabled = true,
}: ProviderProps) {
  const { language } = useAppTranslation();
  const locale = language === "id" ? "id-ID" : "en-US";
  const value = useSocialMediaInsightReportData({
    platformFilter,
    chartsEnabled,
    locale,
  });

  return (
    <SocialMediaInsightReportDataContext.Provider value={value}>
      {children}
    </SocialMediaInsightReportDataContext.Provider>
  );
}

export function useSocialMediaInsightReportDataContext(): SocialMediaInsightReportDataContextValue {
  const ctx = useContext(SocialMediaInsightReportDataContext);
  if (!ctx) {
    throw new Error(
      "useSocialMediaInsightReportDataContext must be used within SocialMediaInsightReportDataProvider",
    );
  }
  return ctx;
}
