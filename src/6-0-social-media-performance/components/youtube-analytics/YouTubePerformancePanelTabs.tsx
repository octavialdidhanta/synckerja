import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { YouTubePerformancePanel } from "@/6-0-social-media-performance/constants/youtubePerformancePanel";

type Props = {
  panel: YouTubePerformancePanel;
  onPanelChange: (panel: YouTubePerformancePanel) => void;
};

export function YouTubePerformancePanelTabs({ panel, onPanelChange }: Props) {
  const { t } = useTranslation();

  const tabs: Array<{ id: YouTubePerformancePanel; labelKey: string; fallback: string }> = [
    {
      id: "videos",
      labelKey: "digitalMarketing.youtubeContent.analytics.panel.videos",
      fallback: "Videos",
    },
    {
      id: "channel-analytics",
      labelKey: "digitalMarketing.youtubeContent.analytics.panel.channelAnalytics",
      fallback: "Channel analytics",
    },
  ];

  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="tablist"
      aria-label={t("digitalMarketing.youtubeContent.analytics.panel.aria", "YouTube performance views")}
    >
      {tabs.map((tab) => {
        const active = panel === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-muted-foreground hover:text-gray-900",
            )}
            onClick={() => onPanelChange(tab.id)}
          >
            {t(tab.labelKey, tab.fallback)}
          </button>
        );
      })}
    </div>
  );
}

YouTubePerformancePanelTabs.displayName = "YouTubePerformancePanelTabs";
