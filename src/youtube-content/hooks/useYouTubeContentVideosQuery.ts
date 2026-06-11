import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type YouTubeContentVideoRow = {
  video_id: string;
  title: string;
  share_url: string | null;
  cover_image_url: string | null;
  duration: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  subscribers_gained: number;
  engagement_rate: number | null;
  posted_at: string | null;
  plan_id: string | null;
  service_name: string | null;
  content_pillar: string | null;
  pic_name: string | null;
  plan_post_date: string | null;
  match_type: string | null;
};

export type YouTubeContentVideosResponse = {
  rows: YouTubeContentVideoRow[];
  summary: {
    video_count: number;
    subscriber_count: number | null;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_subscribers_gained: number;
    avg_engagement_rate: number | null;
    matched_plans: number;
  };
  channel_id: string;
  account_id: string;
  account_label: string | null;
  date_start: string;
  date_end: string;
  cached?: boolean;
};

export async function fetchYouTubeContentVideos(args: {
  organizationId: string;
  channelId: string;
  dateStart: string;
  dateEnd: string;
  forceRefresh?: boolean;
}): Promise<YouTubeContentVideosResponse> {
  const { organizationId, channelId, dateStart, dateEnd, forceRefresh = false } = args;
  const { data, error } = await supabase.functions.invoke("youtube-content-metrics", {
    body: {
      organization_id: organizationId,
      channel_id: channelId,
      date_start: dateStart,
      date_end: dateEnd,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as YouTubeContentVideosResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useYouTubeContentVideosQuery(args: {
  organizationId: string | null | undefined;
  channelId: string;
  dateStart: string;
  dateEnd: string;
  enabled?: boolean;
}) {
  const { organizationId, channelId, dateStart, dateEnd, enabled = true } = args;
  return useQuery({
    queryKey: ["youtube-content-videos", organizationId, channelId, dateStart, dateEnd],
    queryFn: async () => {
      if (!organizationId || !channelId) return null;
      return fetchYouTubeContentVideos({
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
