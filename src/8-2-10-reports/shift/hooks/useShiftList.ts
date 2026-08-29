import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { mapShiftRow, mapShiftSummary } from "../shared/lib/mapShiftRow";
import type { ShiftListSummary, ShiftRow } from "../shared/lib/shiftTypes";

const PAGE_SIZE = 50;

export type UseShiftListArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  openedBy: string | null;
  enabled?: boolean;
};

export function useShiftList(args: UseShiftListArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromIso && args.toIso,
  );

  const query = useInfiniteQuery({
    queryKey: [
      "pos-shift-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
      args.openedBy,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("pos_shift_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
        p_opened_by: args.openedBy,
        p_cursor: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.length || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1] as Partial<Record<string, unknown>>;
      return last.opened_at != null ? String(last.opened_at) : undefined;
    },
  });

  const rows = useMemo(
    () =>
      (query.data?.pages.flat() ?? []).map((r) =>
        mapShiftRow(r as Partial<Record<string, unknown>>),
      ),
    [query.data],
  );

  const summary: ShiftListSummary = useMemo(() => {
    const firstPage = query.data?.pages[0];
    const first = firstPage?.[0] as Partial<Record<string, unknown>> | undefined;
    return mapShiftSummary(first);
  }, [query.data]);

  const isLoading = orgLoading || (enabled && query.isLoading && !query.data);

  return {
    rows,
    summary,
    isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}
