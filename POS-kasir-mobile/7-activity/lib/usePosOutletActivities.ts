import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildPosActivityItemSummary } from "./buildPosActivityItemSummary";
import {
  POS_ACTIVITY_PAGE_SIZE,
  POS_ACTIVITY_QUERY_KEY,
  type PosActivityDetail,
  type PosActivityItem,
  type PosActivityListRow,
} from "./posActivityTypes";

type ActivityHeaderRow = {
  id: string;
  created_at: string;
  date: string | null;
  total_amount: number | null;
  total_paid_amount: number | null;
  payment_method: string | null;
  client_name: string | null;
  client_phone: string | null;
  lead_id: string | null;
  checkout_subtotal: number | null;
  checkout_tax_amount: number | null;
  checkout_gratuity_amount: number | null;
  catalog_sales_type_id?: string | null;
  cash_tendered?: number | null;
  payment_reference?: string | null;
  refund_status?: string | null;
  refund_amount?: number | null;
};

type ItemLite = {
  sales_activity_id: string;
  service_name: string | null;
  sub_service_name: string | null;
};

function mapHeader(row: ActivityHeaderRow, itemSummary: string): PosActivityListRow {
  return {
    id: row.id,
    created_at: row.created_at,
    date: row.date,
    total_amount: Number(row.total_amount ?? 0),
    total_paid_amount: Number(row.total_paid_amount ?? row.total_amount ?? 0),
    payment_method: row.payment_method,
    client_name: row.client_name,
    client_phone: row.client_phone,
    lead_id: row.lead_id,
    checkout_subtotal:
      row.checkout_subtotal == null ? null : Number(row.checkout_subtotal),
    checkout_tax_amount:
      row.checkout_tax_amount == null ? null : Number(row.checkout_tax_amount),
    checkout_gratuity_amount:
      row.checkout_gratuity_amount == null
        ? null
        : Number(row.checkout_gratuity_amount),
    cash_tendered:
      row.cash_tendered == null ? null : Number(row.cash_tendered),
    payment_reference: row.payment_reference ?? null,
    refund_status: row.refund_status === "full" ? "full" : "none",
    refund_amount: Number(row.refund_amount ?? 0),
    itemSummary,
  };
}

async function fetchItemSummaries(
  organizationId: string,
  activityIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (activityIds.length === 0) return map;

  const { data, error } = await supabase
    .from("sales_activity_items")
    .select("sales_activity_id, service_name, sub_service_name")
    .eq("organization_id", organizationId)
    .in("sales_activity_id", activityIds);
  if (error) throw error;

  const byId = new Map<string, ItemLite[]>();
  for (const raw of (data ?? []) as ItemLite[]) {
    const list = byId.get(raw.sales_activity_id) ?? [];
    list.push(raw);
    byId.set(raw.sales_activity_id, list);
  }
  for (const id of activityIds) {
    map.set(id, buildPosActivityItemSummary(byId.get(id) ?? []));
  }
  return map;
}

const SELECT_FIELDS =
  "id, created_at, date, total_amount, total_paid_amount, payment_method, client_name, client_phone, lead_id, checkout_subtotal, checkout_tax_amount, checkout_gratuity_amount, catalog_sales_type_id, cash_tendered, payment_reference, refund_status, refund_amount";

const DETAIL_SELECT_FIELDS = SELECT_FIELDS;

export function usePosOutletActivities(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useInfiniteQuery({
    queryKey: [POS_ACTIVITY_QUERY_KEY, "list", organizationId, outletId],
    enabled: Boolean(organizationId && outletId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<{
      rows: PosActivityListRow[];
      nextCursor: string | null;
    }> => {
      if (!organizationId || !outletId) return { rows: [], nextCursor: null };

      let q = supabase
        .from("sales_activities")
        .select(SELECT_FIELDS)
        .eq("organization_id", organizationId)
        .eq("pos_outlet_id", outletId)
        .eq("activity_type", "Store Checkout")
        .eq("status", "Converted")
        .order("created_at", { ascending: false })
        .limit(POS_ACTIVITY_PAGE_SIZE);

      if (pageParam) {
        q = q.lt("created_at", pageParam);
      }

      const { data, error } = await q;
      if (error) throw error;

      const headers = (data ?? []) as ActivityHeaderRow[];
      const ids = headers.map((h) => h.id);
      const summaries = await fetchItemSummaries(organizationId, ids);
      const rows = headers.map((h) => mapHeader(h, summaries.get(h.id) ?? ""));
      const last = headers[headers.length - 1];
      const nextCursor =
        headers.length >= POS_ACTIVITY_PAGE_SIZE && last?.created_at
          ? last.created_at
          : null;
      return { rows, nextCursor };
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function usePosActivityDetail(activityId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_ACTIVITY_QUERY_KEY, "detail", organizationId, activityId],
    enabled: Boolean(organizationId && activityId),
    queryFn: async (): Promise<PosActivityDetail | null> => {
      if (!organizationId || !activityId) return null;

      const { data: header, error: headerErr } = await supabase
        .from("sales_activities")
        .select(DETAIL_SELECT_FIELDS)
        .eq("organization_id", organizationId)
        .eq("id", activityId)
        .maybeSingle();
      if (headerErr) throw headerErr;
      if (!header) return null;

      const { data: items, error: itemsErr } = await supabase
        .from("sales_activity_items")
        .select(
          "id, service_name, sub_service_name, quantity, unit_price, total_price",
        )
        .eq("organization_id", organizationId)
        .eq("sales_activity_id", activityId)
        .order("created_at", { ascending: true });
      if (itemsErr) throw itemsErr;

      const mappedItems: PosActivityItem[] = ((items ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({
          id: String(row.id),
          service_name: (row.service_name as string | null) ?? null,
          sub_service_name: (row.sub_service_name as string | null) ?? null,
          quantity: Number(row.quantity ?? 0),
          unit_price: Number(row.unit_price ?? 0),
          total_price: Number(row.total_price ?? 0),
        }),
      );

      const h = header as ActivityHeaderRow;
      return {
        ...mapHeader(h, buildPosActivityItemSummary(mappedItems)),
        catalog_sales_type_id: h.catalog_sales_type_id ?? null,
        items: mappedItems,
      };
    },
  });
}

/** Cart snapshot linked to a paid activity (walk-in → empty). */
export function usePosActivityCartSnapshot(activityId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_ACTIVITY_QUERY_KEY, "cart-snapshot", organizationId, activityId],
    enabled: Boolean(organizationId && activityId),
    queryFn: async (): Promise<CustomerVisitCartLine[]> => {
      if (!organizationId || !activityId) return [];
      const { data, error } = await supabase
        .from("pos_table_sessions")
        .select("cart_snapshot")
        .eq("organization_id", organizationId)
        .eq("sales_activity_id", activityId)
        .maybeSingle();
      if (error) throw error;
      const raw = data?.cart_snapshot;
      if (!Array.isArray(raw)) return [];
      return raw as CustomerVisitCartLine[];
    },
  });
}

/** Resolve table session id linked to a paid sales activity (walk-in → null). */
export async function resolvePosActivitySessionId(
  organizationId: string,
  activityId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pos_table_sessions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("sales_activity_id", activityId)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}
