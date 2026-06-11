import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type LinkedInContentPostRow = {
  post_id: string;
  title: string;
  share_url: string | null;
  cover_image_url: string | null;
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

export type LinkedInContentPostsResponse = {
  rows: LinkedInContentPostRow[];
  summary: {
    post_count: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    avg_engagement_rate: number | null;
    matched_plans: number;
  };
  page_id: string;
  account_id: string;
  account_label: string | null;
  date_start: string;
  date_end: string;
  cached?: boolean;
};

export async function fetchLinkedInContentPosts(args: {
  organizationId: string;
  pageId: string;
  dateStart: string;
  dateEnd: string;
  forceRefresh?: boolean;
}): Promise<LinkedInContentPostsResponse> {
  const { organizationId, pageId, dateStart, dateEnd, forceRefresh = false } = args;
  const { data, error } = await supabase.functions.invoke("linkedin-content-metrics", {
    body: {
      organization_id: organizationId,
      page_id: pageId,
      date_start: dateStart,
      date_end: dateEnd,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as LinkedInContentPostsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useLinkedInContentPostsQuery(args: {
  organizationId: string | null | undefined;
  pageId: string;
  dateStart: string;
  dateEnd: string;
  enabled?: boolean;
}) {
  const { organizationId, pageId, dateStart, dateEnd, enabled = true } = args;
  return useQuery({
    queryKey: ["linkedin-content-posts", organizationId, pageId, dateStart, dateEnd],
    queryFn: async () => {
      if (!organizationId || !pageId) return null;
      return fetchLinkedInContentPosts({
        organizationId,
        pageId,
        dateStart,
        dateEnd,
      });
    },
    enabled: Boolean(organizationId && pageId && enabled),
    staleTime: 60_000,
  });
}
