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
  ensurePosCheckoutLead,
  recordPosPaidCustomerVisit,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
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
import { markKitchenTicketsDoneForSession } from "@/pos-mobile/8-kitchen/lib/createPosKitchenTickets";
import {
  fireKitchenForCheckout,
  type FireKitchenForCheckoutResult,
} from "@/pos-mobile/8-kitchen/lib/fireKitchenForCheckout";
import { shouldAutoDoneKitchenOnPay } from "@/pos-mobile/8-kitchen/lib/shouldAutoDoneKitchenOnPay";
import type { KitchenFireBySalesType } from "@/pos-mobile/8-kitchen/lib/kitchenFirePolicy";
import {
  POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY,
  POS_KITCHEN_RECALL_QUERY_KEY,
  POS_KITCHEN_TICKETS_QUERY_KEY,
} from "@/pos-mobile/8-kitchen/lib/posKitchenTypes";
import { ensurePayFirstKitchenSession } from "@/pos-mobile/2-cashier/lib/ensurePayFirstKitchenSession";
import { shouldKeepPayFirstSessionOpen } from "@/pos-mobile/2-cashier/lib/pay-first-seating";
import {
  durationMinutesSince,
  findOpenSessionForTable,
  POS_TABLE_SESSIONS_QUERY_KEY,
} from "@/8-2-9-table-management/hooks/usePosTableSessions";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";

export type PosCashierPayInput = {
  clientName: string;
  clientPhone: string | null;
  clientEmail?: string | null;
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
  /** Kitchen fire on pay + auto-done gating. */
  kitchenCheckout?: {
    outletName: string;
    tableName: string;
    salesTypeLabel: string;
    customerName?: string | null;
    hadKitchenTicketsBeforePay: boolean;
    sessionWasOpenBeforePay: boolean;
    firePolicy: KitchenFireBySalesType;
  };
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

      const [posShiftId, auth] = await Promise.all([
        resolvePosShiftForPay({
          organizationId,
          outletId: input.outletId,
        }),
        supabase.auth.getUser(),
      ]);
      const user = auth.data.user;

      let seatedAt = input.seatedAt ?? null;
      let sessionId = input.sessionId ?? null;
      const originalSessionId = sessionId;
      if (input.posTableId && !sessionId) {
        try {
          const open = await findOpenSessionForTable({
            organizationId,
            posTableId: input.posTableId,
          });
          if (open) {
            sessionId = open.id;
            seatedAt = open.seated_at;
          }
        } catch (err) {
          if (err instanceof Error && err.message === "pos_table_multiple_open_sessions") {
            throw new Error("pos_table_multiple_open_sessions");
          }
          throw err;
        }
      }

      const [servedByUserId, payStockLines] = await Promise.all([
        resolveServedByUserId({
          sessionId,
          servedByUserId: input.servedByUserId,
        }),
        resolvePayStockScopedLines({
          lines: input.lines,
          organizationId,
          outletId: input.outletId,
          sessionId,
        }),
      ]);

      await assertStockForPayLines({
        lines: payStockLines,
        outletId: input.outletId,
      });

      const ensured = await ensurePosCheckoutLead({
        organizationId,
        phone: input.clientPhone,
        email: input.clientEmail?.trim() || null,
        clientName: input.clientName,
        userId: user?.id ?? null,
      });
      const leadId = ensured.leadId;

      let activityId: string | null = null;
      let kitchenFireResult: FireKitchenForCheckoutResult | null = null;
      let resolvedSessionId: string | null = originalSessionId;
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

        const phoneKey = normalizeCustomerVisitPhone(input.clientPhone);
        if (ensured.boundByPhone && phoneKey) {
          await recordPosPaidCustomerVisit({
            organizationId,
            leadId,
            salesActivityId: activityId,
            phoneKey,
            lookupRaw: input.clientPhone,
            createdBy: user?.id ?? null,
            boundByPhone: true,
          });
        }

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

        if (input.kitchenCheckout) {
          let kdsSessionId = originalSessionId ?? resolvedSessionId;
          if (!kdsSessionId) {
            kdsSessionId = await ensurePayFirstKitchenSession({
              organizationId,
              outletId: input.outletId,
              tableName: input.kitchenCheckout.tableName,
              posTableId: input.posTableId ?? null,
              customerName: input.kitchenCheckout.customerName,
              customerPhone: input.clientPhone,
              salesActivityId: activityId,
              closedBy: user?.id ?? null,
              waiterId: servedByUserId,
              keepOpen: shouldKeepPayFirstSessionOpen({
                existingSessionId: originalSessionId,
                salesTypeLabel: input.kitchenCheckout.salesTypeLabel,
              }),
            });
          }

          kitchenFireResult = await fireKitchenForCheckout({
            organizationId,
            outletId: input.outletId,
            outletName: input.kitchenCheckout.outletName,
            sessionId: kdsSessionId,
            cartLines: input.lines,
            event: "on_pay",
            salesTypeLabel: input.kitchenCheckout.salesTypeLabel,
            salesTypeId: input.salesTypeId ?? null,
            tableName: input.kitchenCheckout.tableName,
            posTableId: input.posTableId ?? null,
            customerName: input.kitchenCheckout.customerName,
            hadKitchenTicketsBeforePay: input.kitchenCheckout.hadKitchenTicketsBeforePay,
            firePolicy: input.kitchenCheckout.firePolicy,
            createdBy: user?.id ?? null,
            printTickets: false,
          });
          resolvedSessionId = kdsSessionId;
        }

        if (originalSessionId) {
          if (input.keepSessionOpen) {
            const { error: updErr } = await supabase
              .from("pos_table_sessions")
              .update({
                cart_snapshot: input.remainderCartLines ?? [],
              })
              .eq("id", originalSessionId)
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
              .eq("id", originalSessionId)
              .eq("status", "open");
            if (closeErr) throw closeErr;

            const autoDone = input.kitchenCheckout
              ? shouldAutoDoneKitchenOnPay({
                  hadKitchenTicketsBeforePay:
                    input.kitchenCheckout.hadKitchenTicketsBeforePay,
                  sessionWasOpenBeforePay:
                    input.kitchenCheckout.sessionWasOpenBeforePay,
                  salesTypeLabel: input.kitchenCheckout.salesTypeLabel,
                  settings: input.kitchenCheckout.firePolicy,
                })
              : true;

            if (autoDone) {
              try {
                await markKitchenTicketsDoneForSession(originalSessionId);
              } catch (kdsErr) {
                console.error("markKitchenTicketsDoneForSession failed", kdsErr);
              }
            }
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

      return {
        activityId,
        leadId,
        posShiftId,
        kitchenFireResult,
        sessionId: resolvedSessionId,
      };
    },
    onSuccess: () => {
      if (!organizationId) return;
      queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-visits", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["sales-activities", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["income-transactions", organizationId] });
      void invalidateCatalogStockCaches(queryClient, organizationId);
      queryClient.invalidateQueries({ queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [POS_TABLE_SESSIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [POS_SESSION_STOCK_COMMITS_QUERY_KEY] });
      // KDS board (other devices + same device without relying only on realtime race).
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_TICKETS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_RECALL_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY] });
    },
  });
}
