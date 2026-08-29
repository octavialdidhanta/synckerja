import { supabase } from "@/shared/lib/supabaseClient";
import {
  assertStockForPayLines,
  resolvePayStockScopedLines,
} from "@/stock-management/stock-commit/lib/stockCommitOrchestrator";
import { resolvePosShiftForPay } from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import {
  durationMinutesSince,
  findOpenSessionForTable,
} from "@/8-2-9-table-management/hooks/usePosTableSessions";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { BuildPendingCheckoutPayloadArgs } from "@/shared/pos-qris/lib/buildPendingCheckoutPayload";

export type PreparePosQrisCheckoutInput = {
  organizationId: string;
  outletId: string;
  clientName: string;
  clientPhone: string | null;
  catalogLines: CustomerVisitCartLine[];
  paidCatalogTotals: CatalogCheckoutTotals;
  salesTypeId?: string | null;
  tableNumber?: string | null;
  posTableId?: string | null;
  sessionId?: string | null;
  seatedAt?: string | null;
  servedByUserId?: string | null;
  keepSessionOpen?: boolean;
  remainderCartLines?: CustomerVisitCartLine[] | null;
  paymentChannelId?: string | null;
};

async function ensureWalkInLead(args: {
  organizationId: string;
  clientName: string;
  clientPhone: string | null;
  userId: string | null;
}): Promise<string> {
  const { data: defaultStatusRows } = await supabase
    .from("lead_statuses")
    .select("id")
    .or(`organization_id.eq.${args.organizationId},organization_id.is.null`)
    .order("sort_order", { ascending: true })
    .limit(1);
  const statusId = defaultStatusRows?.[0]?.id ?? null;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ticket_id: `pos-walkin-${crypto.randomUUID()}`,
      client: args.clientName.trim() || "Walk-in",
      title: "POS Walk-in",
      category: "POS",
      created_by: args.userId ?? "00000000-0000-0000-0000-000000000000",
      created_by_name: "Synckerja POS",
      assignee: "",
      status_id: statusId,
      organization_id: args.organizationId,
      source: "POS",
      followup: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("pos_cashier_lead_create_failed");
  return data.id as string;
}

export async function preparePosQrisCheckout(
  input: PreparePosQrisCheckoutInput,
): Promise<{ checkout: BuildPendingCheckoutPayloadArgs; leadId: string; posShiftId: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sessionId = input.sessionId ?? null;
  let seatedAt = input.seatedAt ?? null;
  if (input.posTableId && !sessionId) {
    const open = await findOpenSessionForTable({
      organizationId: input.organizationId,
      posTableId: input.posTableId,
    });
    if (open) {
      sessionId = open.id;
      seatedAt = open.seated_at;
    }
  }

  const payStockLines = await resolvePayStockScopedLines({
    lines: input.catalogLines,
    organizationId: input.organizationId,
    outletId: input.outletId,
    sessionId,
  });

  await assertStockForPayLines({
    lines: payStockLines,
    outletId: input.outletId,
  });

  const posShiftId = await resolvePosShiftForPay({
    organizationId: input.organizationId,
    outletId: input.outletId,
  });

  const leadId = await ensureWalkInLead({
    organizationId: input.organizationId,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    userId: user?.id ?? null,
  });

  const tableDurationMinutes = seatedAt ? durationMinutesSince(seatedAt) : null;

  const checkout: BuildPendingCheckoutPayloadArgs = {
    orgId: input.organizationId,
    leadId,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    createdBy: user?.id ?? null,
    paymentMethod: "qris",
    paymentChannelId: input.paymentChannelId ?? null,
    outletId: input.outletId,
    salesTypeId: input.salesTypeId,
    posShiftId,
    tableNumber: input.tableNumber,
    posTableId: input.posTableId,
    tableDurationMinutes,
    servedByUserId: input.servedByUserId,
    checkoutTotals: input.paidCatalogTotals,
    lines: input.catalogLines,
    sessionId,
    keepSessionOpen: input.keepSessionOpen,
    remainderCartLines: input.remainderCartLines,
  };

  return { checkout, leadId, posShiftId };
}
