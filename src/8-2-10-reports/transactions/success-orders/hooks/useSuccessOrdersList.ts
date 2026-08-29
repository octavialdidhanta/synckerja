import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { groupRowsByLocalDate } from "../../shared/lib/groupTransactionsByDate";
import type {
  SuccessOrderRow,
  SuccessOrdersSummary,
} from "../../shared/lib/transactionsTypes";

const PAGE_SIZE = 50;

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function mapRow(raw: Partial<Record<string, unknown>>): SuccessOrderRow {
  return {
    activityId: String(raw.activity_id ?? ""),
    createdAt: String(raw.created_at ?? ""),
    outletId: raw.outlet_id != null ? String(raw.outlet_id) : null,
    outletName: String(raw.outlet_name ?? "—"),
    receiptCode: String(raw.receipt_code ?? ""),
    collectedByUserId: raw.collected_by_user_id != null ? String(raw.collected_by_user_id) : null,
    collectedByName: String(raw.collected_by_name ?? "—"),
    servedByUserId: raw.served_by_user_id != null ? String(raw.served_by_user_id) : null,
    servedByName: raw.served_by_name != null ? String(raw.served_by_name) : null,
    itemSummary: String(raw.item_summary ?? ""),
    totalCollected: num(raw, "total_collected"),
    netSales: num(raw, "net_sales"),
    grossSales: num(raw, "gross_sales"),
  };
}

export type UseSuccessOrdersListArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  receiptQuery: string;
  enabled?: boolean;
};

export function useSuccessOrdersList(args: UseSuccessOrdersListArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromIso && args.toIso,
  );

  const query = useInfiniteQuery({
    queryKey: [
      "pos-transactions-success-orders",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
      args.receiptQuery,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("pos_transactions_success_orders", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
        p_receipt_query: args.receiptQuery || null,
        p_cursor: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.length || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1] as Partial<Record<string, unknown>>;
      return last.created_at != null ? String(last.created_at) : undefined;
    },
  });

  const rows = useMemo(
    () => (query.data?.pages.flat() ?? []).map((r) => mapRow(r as Partial<Record<string, unknown>>)),
    [query.data],
  );

  const summary: SuccessOrdersSummary = useMemo(() => {
    const firstPage = query.data?.pages[0];
    const first = firstPage?.[0] as Partial<Record<string, unknown>> | undefined;
    return {
      transactionCount: Number(first?.summary_txn_count ?? 0),
      totalCollected: num(first, "summary_total_collected"),
      netSales: num(first, "summary_net_sales"),
    };
  }, [query.data]);

  const groups = useMemo(
    () =>
      groupRowsByLocalDate(rows, (row) => row.totalCollected, (row) => row.createdAt),
    [rows],
  );

  const isLoading = orgLoading || (enabled && query.isLoading && !query.data);

  return {
    rows,
    groups,
    summary,
    isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
  };
}
