import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { groupRowsByLocalDate } from "../../shared/lib/groupTransactionsByDate";
import type { VoidItemRow } from "../../shared/lib/transactionsTypes";

const PAGE_SIZE = 50;

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function mapRow(raw: Partial<Record<string, unknown>>): VoidItemRow {
  return {
    voidId: String(raw.void_id ?? ""),
    createdAt: String(raw.created_at ?? ""),
    outletId: String(raw.outlet_id ?? ""),
    outletName: String(raw.outlet_name ?? "—"),
    sessionId: raw.session_id != null ? String(raw.session_id) : null,
    tableName: String(raw.table_name ?? "—"),
    productName: String(raw.product_name ?? "—"),
    quantity: num(raw, "quantity"),
    unitPrice: num(raw, "unit_price"),
    lineTotal: num(raw, "line_total"),
    reason: String(raw.reason ?? "—"),
    voidedByUserId: raw.voided_by_user_id != null ? String(raw.voided_by_user_id) : null,
    voidedByName: String(raw.voided_by_name ?? "—"),
  };
}

export type UseVoidItemsListArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useVoidItemsList(args: UseVoidItemsListArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromIso && args.toIso,
  );

  const query = useInfiniteQuery({
    queryKey: [
      "pos-transactions-void-items",
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
      const { data, error } = await supabase.rpc("pos_transactions_void_items", {
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
      return last.created_at != null ? String(last.created_at) : undefined;
    },
  });

  const rows = useMemo(
    () => (query.data?.pages.flat() ?? []).map((r) => mapRow(r as Partial<Record<string, unknown>>)),
    [query.data],
  );

  const groups = useMemo(
    () => groupRowsByLocalDate(rows, (row) => row.lineTotal, (row) => row.createdAt),
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
