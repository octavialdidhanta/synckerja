import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';

export type ThreadsContentPostRow = {
  platform: 'threads';
  account_id: string;
  content_id: string;
  posted_at: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  reach: number;
  engagement_rate: number | null;
  caption: string | null;
  media_url: string | null;
  permalink: string | null;
  plan_id: string | null;
  service_name: string | null;
  content_pillar: string | null;
  match_type?: 'share_url' | 'post_id' | null;
};

export type ThreadsContentMetricsPayload = {
  metrics_schema_version: number;
  date_start: string;
  date_end: string;
  account: {
    platform: 'threads';
    account_id: string;
    threads_user_id: string;
    account_label: string;
    avatar_url: string | null;
    audience_count: number | null;
    content_count: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    avg_engagement_rate: number | null;
  };
  posts: ThreadsContentPostRow[];
  fetched_at: string;
};

export async function fetchThreadsContentMetrics(args: {
  organizationId: string;
  accountId: string;
  dateStart?: string;
  dateEnd?: string;
  allTime?: boolean;
}): Promise<ThreadsContentMetricsPayload> {
  const { organizationId, accountId, dateStart, dateEnd, allTime } = args;
  const { data, error } = await supabase.functions.invoke('threads-content-api', {
    body: {
      action: 'getMetrics',
      organization_id: organizationId,
      account_id: accountId,
      ...(allTime ? { all_time: true } : {}),
      ...(dateStart ? { date_start: dateStart } : {}),
      ...(dateEnd ? { date_end: dateEnd } : {}),
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as ThreadsContentMetricsPayload & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useThreadsContentMetricsQuery(args: {
  organizationId: string | null | undefined;
  accountId: string;
  dateStart?: string;
  dateEnd?: string;
  allTime?: boolean;
  enabled?: boolean;
}) {
  const { organizationId, accountId, dateStart, dateEnd, allTime, enabled = true } = args;
  return useQuery({
    queryKey: ['threads-content-metrics', organizationId, accountId, dateStart, dateEnd, allTime],
    queryFn: async () => {
      if (!organizationId || !accountId) return null;
      return fetchThreadsContentMetrics({
        organizationId,
        accountId,
        dateStart,
        dateEnd,
        allTime,
      });
    },
    enabled: Boolean(organizationId && accountId && enabled),
    staleTime: 60_000,
  });
}
