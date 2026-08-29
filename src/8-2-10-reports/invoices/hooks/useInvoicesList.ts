import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { InvoiceDisplayStatus } from "../shared/lib/computeInvoiceDisplayStatus";
import type { InvoiceRow, InvoicesSummary } from "../shared/lib/invoicesTypes";

const PAGE_SIZE = 50;

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function mapRow(raw: Partial<Record<string, unknown>>): InvoiceRow {
  return {
    activityId: String(raw.activity_id ?? ""),
    invoiceNumber: String(raw.invoice_number ?? ""),
    createdAt: String(raw.created_at ?? ""),
    invoiceDueDate: raw.invoice_due_date != null ? String(raw.invoice_due_date) : null,
    outletId: raw.outlet_id != null ? String(raw.outlet_id) : null,
    outletName: String(raw.outlet_name ?? "—"),
    clientName: String(raw.client_name ?? "—"),
    displayStatus: String(raw.display_status ?? "unpaid") as InvoiceDisplayStatus,
    overdueDays: raw.overdue_days != null ? Number(raw.overdue_days) : null,
    totalAmount: num(raw, "total_amount"),
    totalPaidAmount: num(raw, "total_paid_amount"),
    amountDue: num(raw, "amount_due"),
    itemSummary: String(raw.item_summary ?? ""),
  };
}

export type UseInvoicesListArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  statusFilter: string;
  searchQuery: string;
  enabled?: boolean;
};

export function useInvoicesList(args: UseInvoicesListArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromIso && args.toIso,
  );

  const query = useInfiniteQuery({
    queryKey: [
      "pos-invoices-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
      args.statusFilter,
      args.searchQuery,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const status =
        args.statusFilter === "all" || !args.statusFilter ? null : args.statusFilter;
      const { data, error } = await supabase.rpc("pos_invoices_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
        p_status_filter: status,
        p_search_query: args.searchQuery || null,
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
    () =>
      (query.data?.pages.flat() ?? []).map((r) =>
        mapRow(r as Partial<Record<string, unknown>>),
      ),
    [query.data],
  );

  const summary: InvoicesSummary = useMemo(() => {
    const firstPage = query.data?.pages[0];
    const first = firstPage?.[0] as Partial<Record<string, unknown>> | undefined;
    return {
      count: Number(first?.summary_count ?? 0),
      unpaid: Number(first?.summary_unpaid ?? 0),
      partial: Number(first?.summary_partial ?? 0),
      paid: Number(first?.summary_paid ?? 0),
      overdue: Number(first?.summary_overdue ?? 0),
      cancelled: Number(first?.summary_cancelled ?? 0),
    };
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
