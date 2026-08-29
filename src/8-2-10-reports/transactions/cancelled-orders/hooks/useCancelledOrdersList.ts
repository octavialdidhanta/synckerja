import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { groupRowsByLocalDate } from "../../shared/lib/groupTransactionsByDate";
import { computeCartSnapshotTotal } from "../../shared/lib/computeCartSnapshotTotal";
import type { CancelledOrderRow } from "../../shared/lib/transactionsTypes";

const PAGE_SIZE = 50;

function mapRow(raw: Partial<Record<string, unknown>>): CancelledOrderRow {
  return {
    sessionId: String(raw.session_id ?? ""),
    closedAt: String(raw.closed_at ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    outletName: String(raw.outlet_name ?? "—"),
    tableName: String(raw.table_name ?? "—"),
    staffUserId: raw.staff_user_id != null ? String(raw.staff_user_id) : null,
    staffName: String(raw.staff_name ?? "—"),
    cancelReason: String(raw.cancel_reason ?? "—"),
    itemSummary: String(raw.item_summary ?? ""),
    cartSnapshot: Array.isArray(raw.cart_snapshot) ? raw.cart_snapshot : [],
  };
}

export type UseCancelledOrdersListArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useCancelledOrdersList(args: UseCancelledOrdersListArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromIso && args.toIso,
  );

  const query = useInfiniteQuery({
    queryKey: [
      "pos-transactions-cancelled-orders",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("pos_transactions_cancelled_orders", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
        p_cursor: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.length || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1] as Partial<Record<string, unknown>>;
      return last.closed_at != null ? String(last.closed_at) : undefined;
    },
  });

  const rows = useMemo(
    () => (query.data?.pages.flat() ?? []).map((r) => mapRow(r as Partial<Record<string, unknown>>)),
    [query.data],
  );

  const groups = useMemo(
    () =>
      groupRowsByLocalDate(
        rows,
        (row) => computeCartSnapshotTotal(row.cartSnapshot),
        (row) => row.closedAt,
      ),
    [rows],
  );

  const isLoading = orgLoading || (enabled && query.isLoading && !query.data);

  return {
    rows,
    groups,
    isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
  };
}
