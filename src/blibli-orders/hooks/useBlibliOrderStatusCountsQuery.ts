import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { BlibliOrderStatusTab } from '../lib/blibliOrderStatusTabs';

export type BlibliOrderStatusCounts = Record<BlibliOrderStatusTab, number>;

type Input = {
  organizationId: string | null | undefined;
  connectionId?: string | null;
  dateRange?: { start: number; end: number } | null;
  enabled?: boolean;
};

async function fetchCounts(input: {
  organizationId: string;
  connectionId?: string | null;
  dateRange?: { start: number; end: number } | null;
}): Promise<BlibliOrderStatusCounts> {
  const { data, error } = await supabase.functions.invoke('blibli-seller-orders', {
    body: {
      action: 'getStatusCounts',
      organization_id: input.organizationId,
      ...(input.connectionId ? { connection_id: input.connectionId } : {}),
      ...(input.dateRange ? { status_fp_date_range: input.dateRange } : {}),
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { counts?: Record<string, number>; error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  const c = payload.counts ?? {};
  return {
    all: Number(c.all ?? 0) || 0,
    new: Number(c.new ?? 0) || 0,
    in_process: Number(c.in_process ?? 0) || 0,
    delivered: Number(c.delivered ?? 0) || 0,
    cancel: Number(c.cancel ?? 0) || 0,
  };
}

/** Debounced / lower priority counts — longer staleTime to respect rate limits. */
export function useBlibliOrderStatusCountsQuery(input: Input) {
  return useQuery({
    queryKey: [
      'blibli-order-status-counts',
      input.organizationId,
      input.connectionId,
      input.dateRange?.start,
      input.dateRange?.end,
    ],
    queryFn: () =>
      fetchCounts({
        organizationId: input.organizationId!,
        connectionId: input.connectionId,
        dateRange: input.dateRange,
      }),
    enabled: Boolean(input.organizationId) && input.enabled !== false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
