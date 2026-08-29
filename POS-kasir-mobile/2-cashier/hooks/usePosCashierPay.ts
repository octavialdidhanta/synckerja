import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOmnichannelIncomeBankAccount } from "@/shared/hooks/finance/useOmnichannelIncomeBankAccount";
import { supabase } from "@/shared/lib/supabaseClient";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { applyStoreCheckoutOfflineSales } from "@/5-2-customer-visits/checkout/lib/applyStoreCheckoutOfflineSales";
import {
  createStoreCheckoutSalesActivity,
  markLeadConvertedIfNeeded,
  rollbackStoreCheckoutSalesActivity,
} from "@/5-2-customer-visits/checkout/lib/createStoreCheckoutSalesActivity";
import {
  recordStoreCheckoutIncome,
  storeCheckoutNeedsOmnichannelBank,
} from "@/5-2-customer-visits/checkout/lib/recordStoreCheckoutIncome";
import {
  assertStockForPayLines,
  resolvePayStockScopedLines,
} from "@/stock-management/stock-commit/lib/stockCommitOrchestrator";
import { reverseStoreCheckoutStock } from "@/stock-management/stock-commit/rpc/applyCatalogStockReserve";
import { POS_SESSION_STOCK_COMMITS_QUERY_KEY } from "@/stock-management/stock-commit/hooks/usePosSessionStockCommits";
import type {
  CustomerVisitCartLine,
  CustomerVisitCheckoutPaymentMethod,
} from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  POS_CASHIER_SHIFTS_QUERY_KEY,
  resolvePosShiftForPay,
} from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import {
  durationMinutesSince,
  findOpenSessionForTable,
  POS_TABLE_SESSIONS_QUERY_KEY,
} from "@/8-2-9-table-management/hooks/usePosTableSessions";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";

export type PosCashierPayInput = {
  clientName: string;
  clientPhone: string | null;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  paymentChannelId?: string | null;
  paymentReference?: string | null;
  cashTendered?: number | null;
  outletId: string;
  salesTypeId?: string | null;
  checkoutTotals: CatalogCheckoutTotals;
  lines: CustomerVisitCartLine[];
  tableNumber?: string | null;
  posTableId?: string | null;
  sessionId?: string | null;
  seatedAt?: string | null;
  /** When true and sessionId set, keep session open and rewrite cart_snapshot. */
  keepSessionOpen?: boolean;
  remainderCartLines?: CustomerVisitCartLine[] | null;
  /** Waiter / order taker (from table session at pay). */
  servedByUserId?: string | null;
};

async function resolveServedByUserId(args: {
  sessionId: string | null;
  servedByUserId?: string | null;
}): Promise<string | null> {
  if (args.servedByUserId !== undefined) return args.servedByUserId;
  if (!args.sessionId) return null;
  const { data, error } = await supabase
    .from("pos_table_sessions")
    .select("waiter_id, opened_by")
    .eq("id", args.sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (data.waiter_id as string | null) ?? (data.opened_by as string | null) ?? null;
}

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

export function usePosCashierPay() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { omnichannelBank } = useOmnichannelIncomeBankAccount();

  return useMutation({
    mutationFn: async (input: PosCashierPayInput) => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (storeCheckoutNeedsOmnichannelBank(input.paymentMethod) && !omnichannelBank?.id) {
        throw new Error("store_checkout_omnichannel_bank_missing");
      }

      const posShiftId = await resolvePosShiftForPay({
        organizationId,
        outletId: input.outletId,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let seatedAt = input.seatedAt ?? null;
      let sessionId = input.sessionId ?? null;
      if (input.posTableId && !sessionId) {
        const open = await findOpenSessionForTable({
          organizationId,
          posTableId: input.posTableId,
        });
        if (open) {
          sessionId = open.id;
          seatedAt = open.seated_at;
        }
      }

      const servedByUserId = await resolveServedByUserId({
        sessionId,
        servedByUserId: input.servedByUserId,
      });

      const payStockLines = await resolvePayStockScopedLines({
        lines: input.lines,
        organizationId,
        outletId: input.outletId,
        sessionId,
      });

      await assertStockForPayLines({
        lines: payStockLines,
        outletId: input.outletId,
      });

      const leadId = await ensureWalkInLead({
        organizationId,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        userId: user?.id ?? null,
      });

      let activityId: string | null = null;
      try {
        const tableDurationMinutes = seatedAt ? durationMinutesSince(seatedAt) : null;

        activityId = await createStoreCheckoutSalesActivity({
          orgId: organizationId,
          leadId,
          clientName: input.clientName,
          clientPhone: input.clientPhone,
          createdBy: user?.id ?? null,
          paymentMethod: input.paymentMethod,
          paymentChannelId: input.paymentChannelId ?? null,
          paymentReference: input.paymentReference ?? null,
          cashTendered: input.cashTendered,
          outletId: input.outletId,
          salesTypeId: input.salesTypeId,
          posShiftId,
          tableNumber: input.tableNumber ?? null,
          posTableId: input.posTableId ?? null,
          tableDurationMinutes,
          servedByUserId,
          checkoutTotals: input.checkoutTotals,
          lines: input.lines,
        });

        await applyStoreCheckoutOfflineSales({
          organizationId,
          activityId,
          outletId: input.outletId,
          lines: input.lines,
          stockLines: payStockLines,
        });

        await recordStoreCheckoutIncome({
          activityId,
          paymentMethod: input.paymentMethod,
        });

        await markLeadConvertedIfNeeded({
          orgId: organizationId,
          leadId,
          changedBy: user?.id ?? null,
        });

        if (sessionId) {
          if (input.keepSessionOpen) {
            const { error: updErr } = await supabase
              .from("pos_table_sessions")
              .update({
                cart_snapshot: input.remainderCartLines ?? [],
              })
              .eq("id", sessionId)
              .eq("status", "open");
            if (updErr) throw updErr;
          } else {
            const { error: closeErr } = await supabase
              .from("pos_table_sessions")
              .update({
                status: "paid",
                closed_at: new Date().toISOString(),
                sales_activity_id: activityId,
                closed_by: user?.id ?? null,
              })
              .eq("id", sessionId)
              .eq("status", "open");
            if (closeErr) throw closeErr;
          }
        }
      } catch (err) {
        if (activityId) {
          try {
            await reverseStoreCheckoutStock({ organizationId, activityId });
          } catch (reverseErr) {
            console.error("reverseStoreCheckoutStock failed", reverseErr);
          }
          await rollbackStoreCheckoutSalesActivity(activityId);
        }
        throw err;
      }

      return { activityId, leadId, posShiftId };
    },
    onSuccess: () => {
      if (!organizationId) return;
      queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["sales-activities", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["income-transactions", organizationId] });
      void invalidateCatalogStockCaches(queryClient, organizationId);
      queryClient.invalidateQueries({ queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [POS_TABLE_SESSIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [POS_SESSION_STOCK_COMMITS_QUERY_KEY] });
    },
  });
}
