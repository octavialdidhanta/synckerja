import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type TikTokContentVideoRow = {
  video_id: string;
  title: string;
  share_url: string | null;
  cover_image_url: string | null;
  duration: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  engagement_rate: number | null;
  posted_at: string | null;
  plan_id: string | null;
  service_name: string | null;
  content_pillar: string | null;
  pic_name: string | null;
  plan_post_date: string | null;
  match_type: string | null;
};

export type TikTokContentVideosResponse = {
  rows: TikTokContentVideoRow[];
  summary: {
    video_count: number;
    follower_count: number | null;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    avg_engagement_rate: number | null;
    matched_plans: number;
  };
  open_id: string;
  account_id: string;
  account_label: string | null;
  date_start: string;
  date_end: string;
  cached?: boolean;
};

export async function fetchTikTokContentVideos(args: {
  organizationId: string;
  openId: string;
  dateStart: string;
  dateEnd: string;
  forceRefresh?: boolean;
}): Promise<TikTokContentVideosResponse> {
  const { organizationId, openId, dateStart, dateEnd, forceRefresh = false } = args;
  const { data, error } = await supabase.functions.invoke("tiktok-content-metrics", {
    body: {
      organization_id: organizationId,
      open_id: openId,
      date_start: dateStart,
      date_end: dateEnd,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokContentVideosResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokContentVideosQuery(args: {
  organizationId: string | null | undefined;
  openId: string;
  dateStart: string;
  dateEnd: string;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
  /** Bypass server-side metrics cache (use for live Manage Comments polling). */
  forceRefresh?: boolean;
}) {
  const {
    organizationId,
    openId,
    dateStart,
    dateEnd,
    enabled = true,
    refetchIntervalMs = false,
    forceRefresh = false,
  } = args;
  const queryEnabled = Boolean(organizationId && openId && enabled);
  return useQuery({
    queryKey: ["tiktok-content-videos", organizationId, openId, dateStart, dateEnd],
    queryFn: async () => {
      if (!organizationId || !openId) return null;
      return fetchTikTokContentVideos({
        organizationId,
        openId,
        dateStart,
        dateEnd,
        forceRefresh,
      });
    },
    enabled: queryEnabled,
    staleTime: refetchIntervalMs ? 0 : 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: queryEnabled && refetchIntervalMs ? refetchIntervalMs : false,
    refetchIntervalInBackground: false,
  });
}
