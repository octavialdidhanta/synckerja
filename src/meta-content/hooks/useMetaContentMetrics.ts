import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { MetaContentMetricsPayload, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

export async function fetchMetaContentMetrics(args: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  dateStart?: string;
  dateEnd?: string;
  allTime?: boolean;
}): Promise<MetaContentMetricsPayload> {
  const { data, error } = await supabase.functions.invoke('meta-content-metrics', {
    body: {
      action: 'account_metrics',
      organization_id: args.organizationId,
      platform: args.platform,
      account_id: args.accountId,
      date_start: args.dateStart ?? '',
      date_end: args.dateEnd ?? '',
      all_time: args.allTime === true,
      _client_ts: Date.now(),
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as MetaContentMetricsPayload & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useMetaContentMetricsQuery(args: {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string;
  dateStart?: string;
  dateEnd?: string;
  allTime?: boolean;
  enabled?: boolean;
}) {
  const { organizationId, platform, accountId, dateStart, dateEnd, allTime, enabled = true } = args;
  const rangeKeyStart = allTime ? 'all_time' : (dateStart ?? 'all_time');
  const rangeKeyEnd = allTime ? 'all_time' : (dateEnd ?? 'all_time');

  return useQuery({
    queryKey: [
      'meta-content-metrics',
      'v17',
      organizationId,
      platform,
      accountId,
      rangeKeyStart,
      rangeKeyEnd,
    ],
    enabled: Boolean(organizationId && accountId && enabled),
    queryFn: () =>
      fetchMetaContentMetrics({
        organizationId: organizationId!,
        platform,
        accountId,
        dateStart,
        dateEnd,
        allTime,
      }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}
