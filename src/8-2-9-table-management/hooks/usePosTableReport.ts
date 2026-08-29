import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export const POS_TABLE_REPORT_QUERY_KEY = "pos-table-report";

export type PosTableReportRow = {
  id: string;
  client_name: string | null;
  status: string | null;
  date: string | null;
  created_at: string;
  table_number: string | null;
  pos_table_id: string | null;
  table_duration_minutes: number | null;
  total_amount: number | null;
  created_by: string | null;
  pos_outlet_id: string | null;
  receipt_code: string;
};

export type PosTableReportItem = {
  id: string;
  service_name: string | null;
  sub_service_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type PosTableReportFilters = {
  outletId: string | null;
  dateFrom: string;
  dateTo: string;
  tableKey: string | null; // pos_table_id or `name:${table_number}`
};

function receiptCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 7).toUpperCase();
}

export function usePosTableReport(filters: PosTableReportFilters) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && filters.outletId && filters.dateFrom && filters.dateTo);

  const query = useQuery({
    queryKey: [
      POS_TABLE_REPORT_QUERY_KEY,
      organizationId,
      filters.outletId,
      filters.dateFrom,
      filters.dateTo,
      filters.tableKey,
    ],
    enabled,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<PosTableReportRow[]> => {
      if (!organizationId || !filters.outletId) return [];
      let q = supabase
        .from("sales_activities")
        .select(
          "id, client_name, status, date, created_at, table_number, pos_table_id, table_duration_minutes, total_amount, created_by, pos_outlet_id",
        )
        .eq("organization_id", organizationId)
        .eq("pos_outlet_id", filters.outletId)
        .eq("activity_type", "Store Checkout")
        .gte("date", filters.dateFrom)
        .lte("date", filters.dateTo)
        .order("created_at", { ascending: false })
        .limit(500);

      const { data, error } = await q;
      if (error) throw error;

      let rows = (data ?? []).map((r) => ({
        ...(r as Omit<PosTableReportRow, "receipt_code">),
        receipt_code: receiptCode((r as { id: string }).id),
      })) as PosTableReportRow[];

      // Prefer table-linked rows; still show store checkouts with table label
      rows = rows.filter((r) => r.pos_table_id || r.table_number);

      if (filters.tableKey) {
        if (filters.tableKey.startsWith("name:")) {
          const name = filters.tableKey.slice(5).toLowerCase();
          rows = rows.filter((r) => (r.table_number ?? "").toLowerCase() === name);
        } else {
          rows = rows.filter((r) => r.pos_table_id === filters.tableKey);
        }
      }

      return rows;
    },
  });

  const summary = useMemo(() => {
    const rows = query.data ?? [];
    let completed = 0;
    let cancelled = 0;
    for (const r of rows) {
      const s = (r.status ?? "").toLowerCase();
      if (s.includes("cancel") || s.includes("void")) cancelled += 1;
      else completed += 1;
    }
    const byTable = new Map<string, { label: string; count: number; durationSum: number; durationN: number }>();
    for (const r of rows) {
      const key = r.pos_table_id || `name:${r.table_number ?? "?"}`;
      const label = r.table_number || key;
      const cur = byTable.get(key) ?? { label, count: 0, durationSum: 0, durationN: 0 };
      cur.count += 1;
      if (r.table_duration_minutes != null) {
        cur.durationSum += r.table_duration_minutes;
        cur.durationN += 1;
      }
      byTable.set(key, cur);
    }
    return { completed, cancelled, byTable: [...byTable.entries()] };
  }, [query.data]);

  const tableOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of query.data ?? []) {
      if (r.pos_table_id) map.set(r.pos_table_id, r.table_number || r.pos_table_id.slice(0, 8));
      else if (r.table_number) map.set(`name:${r.table_number}`, r.table_number);
    }
    // Rebuild from unfiltered would be better — use summary keys from a separate query.
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [query.data]);

  return {
    rows: query.data ?? [],
    isLoading: enabled ? query.isLoading : false,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    summary,
    tableOptions,
  };
}

/** Distinct table options for outlet+range (ignores table filter). */
export function usePosTableReportTableOptions(args: {
  outletId: string | null;
  dateFrom: string;
  dateTo: string;
}) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && args.outletId);

  return useQuery({
    queryKey: [
      POS_TABLE_REPORT_QUERY_KEY,
      "tables",
      organizationId,
      args.outletId,
      args.dateFrom,
      args.dateTo,
    ],
    enabled,
    queryFn: async (): Promise<{ value: string; label: string }[]> => {
      if (!organizationId || !args.outletId) return [];
      const { data, error } = await supabase
        .from("sales_activities")
        .select("table_number, pos_table_id")
        .eq("organization_id", organizationId)
        .eq("pos_outlet_id", args.outletId)
        .eq("activity_type", "Store Checkout")
        .gte("date", args.dateFrom)
        .lte("date", args.dateTo)
        .limit(500);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of data ?? []) {
        const row = r as { table_number: string | null; pos_table_id: string | null };
        if (row.pos_table_id) {
          map.set(row.pos_table_id, row.table_number || row.pos_table_id.slice(0, 8));
        } else if (row.table_number) {
          map.set(`name:${row.table_number}`, row.table_number);
        }
      }
      return [...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  });
}

export function usePosTableReportOrderItems(activityId: string | null) {
  const { organizationId } = useCurrentOrg();
  const enabled = Boolean(organizationId && activityId);

  return useQuery({
    queryKey: [POS_TABLE_REPORT_QUERY_KEY, "items", organizationId, activityId],
    enabled,
    queryFn: async (): Promise<PosTableReportItem[]> => {
      if (!organizationId || !activityId) return [];
      const { data, error } = await supabase
        .from("sales_activity_items")
        .select("id, service_name, sub_service_name, quantity, unit_price, total_price")
        .eq("organization_id", organizationId)
        .eq("sales_activity_id", activityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PosTableReportItem[];
    },
  });
}
