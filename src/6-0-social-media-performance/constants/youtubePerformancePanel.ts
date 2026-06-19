export const YOUTUBE_PERFORMANCE_PANELS = ["videos", "channel-analytics"] as const;

export type YouTubePerformancePanel = (typeof YOUTUBE_PERFORMANCE_PANELS)[number];

export const DEFAULT_YOUTUBE_PERFORMANCE_PANEL: YouTubePerformancePanel = "videos";

export function parseYouTubePerformancePanel(value: string | null): YouTubePerformancePanel {
  if (value === "channel-analytics") return "channel-analytics";
  return "videos";
}

export const YOUTUBE_PERFORMANCE_PANEL_PARAM = "panel";
