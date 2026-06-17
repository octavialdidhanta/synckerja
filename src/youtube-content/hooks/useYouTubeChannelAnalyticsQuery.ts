import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";
import type { YouTubeChannelAnalyticsResponse } from "@/youtube-content/types/youtubeChannelAnalyticsTypes";

export async function fetchYouTubeChannelAnalytics(args: {
  organizationId: string;
  channelId: string;
  dateStart: string;
  dateEnd: string;
  forceRefresh?: boolean;
}): Promise<YouTubeChannelAnalyticsResponse> {
  const { organizationId, channelId, dateStart, dateEnd, forceRefresh = false } = args;
  const { data, error } = await supabase.functions.invoke("youtube-content-channel-analytics", {
    body: {
      organization_id: organizationId,
      channel_id: channelId,
      date_start: dateStart,
      date_end: dateEnd,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as YouTubeChannelAnalyticsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useYouTubeChannelAnalyticsQuery(args: {
  organizationId: string | null | undefined;
  channelId: string;
  dateStart: string;
  dateEnd: string;
  enabled?: boolean;
}) {
  const { organizationId, channelId, dateStart, dateEnd, enabled = true } = args;
  return useQuery({
    queryKey: ["youtube-channel-analytics", organizationId, channelId, dateStart, dateEnd],
    queryFn: async () => {
      if (!organizationId || !channelId) return null;
      return fetchYouTubeChannelAnalytics({
        organizationId,
        channelId,
        dateStart,
        dateEnd,
      });
    },
    enabled: Boolean(organizationId && channelId && enabled),
    staleTime: 60_000,
  });
}
