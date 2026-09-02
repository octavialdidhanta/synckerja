import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import {
  usePosOpenTableSessions,
  usePosTableSessionMutations,
} from "@/8-2-9-table-management/hooks/usePosTableSessions";
import { sumCustomerVisitCart } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { PosCashierMenuDrawer } from "@/pos-mobile/2-cashier/components/PosCashierMenuDrawer";
import {
  PosBillListDialog,
  PosBillReasonDialog,
} from "@/pos-mobile/2-cashier/components/bill-list";
import {
  usePosBillListCancelledSessions,
  usePosBillListOpenSessions,
  usePosBillListPaidSessions,
  type PosBillListRow,
} from "@/pos-mobile/2-cashier/hooks/usePosBillListSessions";
import { usePosCheckoutRefund } from "@/pos-mobile/2-cashier/hooks/usePosCheckoutRefund";
import { usePosFulfillmentStockCommit } from "@/pos-mobile/2-cashier/hooks/usePosFulfillmentStockCommit";
import { usePosLineVoids } from "@/pos-mobile/2-cashier/hooks/usePosLineVoids";
import { POS_BILL_LIST_I18N } from "@/pos-mobile/2-cashier/lib/posBillListCopy";
import { POS_STOCK_COMMIT_I18N } from "@/pos-mobile/2-cashier/lib/posStockCommitCopy";
import { usePosOpenShift } from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import { usePosPinGate } from "@/pos-mobile/shared/hooks/usePosPinGate";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import { POS_PIN_FEATURES } from "@/pos-mobile/shared/lib/posPinFeatures";
import { printPosReceiptBill } from "@/pos-mobile/shared/printing/posPrintService";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { POS_SETTINGS_I18N } from "@/pos-mobile/3-settings/lib/posSettingsCopy";
import { usePosOutletStockSettings } from "@/stock-management/stock-commit/hooks/usePosOutletStockSettings";
import { computeTableOccupancy } from "@/8-2-9-table-management/sessions";
import { PosSelectTableBillSheet } from "@/pos-mobile/2-cashier/components/select-table/PosSelectTableBillSheet";
import { PosTableMapCanvas } from "../components/PosTableMapCanvas";
import { PosTableMapFooter } from "../components/PosTableMapFooter";
import { PosTableMapHeader } from "../components/PosTableMapHeader";
import {
  PosTableMapTableSheet,
  type PosTableMapSheetTarget,
} from "../components/PosTableMapTableSheet";
import { usePosMobileTableGroups } from "../hooks/usePosMobileTableGroups";
import { usePosMobileFloorFixtures } from "../hooks/usePosMobileFloorFixtures";
import { usePosMobileTables } from "../hooks/usePosMobileTables";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";
import {
  clearPosSelectedTable,
  stashPosSelectedTable,
} from "../lib/posSelectedTableStorage";
import { PosTableMapSkeleton } from "./PosTableMapSkeleton";

function draftTotalsFromCart(subtotal: number): CatalogCheckoutTotals {
  return {
    subtotal,
    taxBase: subtotal,
    taxLines: [],
    gratuityLines: [],
    taxTotal: 0,
    gratuityTotal: 0,
    grandTotal: subtotal,
    applicationMethod: "add",
  };
}

/**
 * Synckerja POS Table Map — read-only floor plan for the selected outlet.
 * Authenticated route: `/pos/table-map`.
 */
export default function PosTableMapPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: orgLoading } = useCentralizedUserData();
  const { organizationId } = useCurrentOrg();
  const permissions = usePosAppPermissions();

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const outletName = outletMeta?.name || "";
  const { runWithPin, pinDialog } = usePosPinGate(outletId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<PosTableMapSheetTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [billPickTable, setBillPickTable] = useState<PosTable | null>(null);
  const [billListOpen, setBillListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PosBillListRow | null>(null);
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const groupsQuery = usePosMobileTableGroups(outletId);
  const activeGroups = groupsQuery.activeGroups;
  const openSessions = usePosOpenTableSessions(outletId);
  const billListOpenSessions = usePosBillListOpenSessions(outletId);
  const billListCancelled = usePosBillListCancelledSessions(outletId);
  const billListPaid = usePosBillListPaidSessions(outletId);
  const lineVoids = usePosLineVoids(outletId);
  const fulfillStock = usePosFulfillmentStockCommit();
  const { stockCommitPoint } = usePosOutletStockSettings(outletId);
  const checkoutRefund = usePosCheckoutRefund();
  const openShiftQuery = usePosOpenShift(outletId);
  const sessionMutations = usePosTableSessionMutations(outletId);

  const groupFromUrl = searchParams.get("group");
  const activeGroupId = useMemo(() => {
    if (activeGroups.length === 0) return null;
    if (groupFromUrl && activeGroups.some((g) => g.id === groupFromUrl)) {
      return groupFromUrl;
    }
    return activeGroups[0].id;
  }, [activeGroups, groupFromUrl]);

  const activeGroupName = useMemo(
    () => activeGroups.find((g) => g.id === activeGroupId)?.name ?? "",
    [activeGroups, activeGroupId],
  );

  useEffect(() => {
    if (!activeGroupId) return;
    if (groupFromUrl === activeGroupId) return;
    setSearchParams({ group: activeGroupId }, { replace: true });
  }, [activeGroupId, groupFromUrl, setSearchParams]);

  const tablesQuery = usePosMobileTables(activeGroupId);
  const fixturesQuery = usePosMobileFloorFixtures(activeGroupId);
  const tables = tablesQuery.tables ?? [];
  const fixtures = fixturesQuery.fixtures ?? [];

  const onSelectOpenBill = useCallback(
    (row: PosBillListRow) => {
      if (!outletId) return;
      const { session } = row;
      if (!session.pos_table_id || !session.group_id) {
        stashPosSelectedTable({
          id: "",
          name: session.table_name,
          groupId: "",
          pax: session.pax,
          outletId,
          sessionId: session.id,
          seatedAt: session.seated_at,
          cartSnapshot: session.cart_snapshot,
        });
      } else {
        stashPosSelectedTable({
          id: session.pos_table_id,
          name: session.table_name,
          groupId: session.group_id,
          pax: session.pax,
          outletId,
          sessionId: session.id,
          seatedAt: session.seated_at,
          cartSnapshot: session.cart_snapshot,
        });
      }
      setBillListOpen(false);
      navigate(POS_AUTH_PATHS.cashier);
    },
    [navigate, outletId],
  );

  const onNewBillFromList = useCallback(() => {
    clearPosSelectedTable();
    setBillListOpen(false);
    navigate(POS_AUTH_PATHS.cashier);
  }, [navigate]);

  const confirmCancelFromList = useCallback(
    (reason: string) => {
      if (!cancelTarget) return;
      const sessionId = cancelTarget.session.id;
      setCancelTarget(null);
      runWithPin(POS_PIN_FEATURES.manageOpenBills, () => {
        void (async () => {
          setBusy(true);
          try {
            await sessionMutations.cancelOpen.mutateAsync({
              sessionId,
              reason,
              organizationId: organizationId ?? undefined,
              outletId: outletId ?? undefined,
            });
            toast({
              title: t(POS_BILL_LIST_I18N.cancelSuccess, "Bill cancelled"),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast({
              title: t(POS_TABLE_MAP_I18N.sheetDeleteError, "Failed to delete bill"),
              description: msg,
              variant: "destructive",
            });
          } finally {
            setBusy(false);
          }
        })();
      });
    },
    [
      cancelTarget,
      organizationId,
      outletId,
      runWithPin,
      sessionMutations.cancelOpen,
      t,
      toast,
    ],
  );

  const onFulfillOpenBill = useCallback(
    (row: PosBillListRow) => {
      if (!outletId) return;
      const lines = Array.isArray(row.session.cart_snapshot)
        ? row.session.cart_snapshot
        : [];
      void (async () => {
        try {
          await fulfillStock.mutateAsync({
            outletId,
            sessionId: row.session.id,
            cartLines: lines,
          });
          toast({
            title: t(POS_STOCK_COMMIT_I18N.fulfillSuccess, "Order marked as shipped"),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toast({
            title: t(POS_STOCK_COMMIT_I18N.fulfillError, "Failed to complete shipment"),
            description: message,
            variant: "destructive",
          });
        }
      })();
    },
    [fulfillStock, outletId, t, toast],
  );

  const onRefundPaidBill = useCallback(
    (row: PosBillListRow) => {
      const activityId = row.session.sales_activity_id;
      if (!activityId) {
        toast({
          title: t(POS_STOCK_COMMIT_I18N.refundError, "Failed to refund checkout stock"),
          description: t(
            POS_STOCK_COMMIT_I18N.refundActivityRequired,
            "This paid bill has no sales activity to refund.",
          ),
          variant: "destructive",
        });
        return;
      }
      if (row.refundStatus === "full") {
        toast({ title: t(POS_BILL_LIST_I18N.refundedBadge, "Refunded") });
        return;
      }
      runWithPin(POS_PIN_FEATURES.issueRefunds, () => {
        void (async () => {
          setRefundBusyId(row.session.id);
          try {
            await checkoutRefund.mutateAsync({
              activityId,
              sessionId: row.session.id,
              outletId: row.session.outlet_id ?? outletId,
              shiftId: openShiftQuery.data?.id ?? null,
            });
            toast({
              title: t(POS_STOCK_COMMIT_I18N.refundSuccess, "Checkout stock refunded"),
            });
            void billListPaid.refetch();
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            toast({
              title: t(POS_STOCK_COMMIT_I18N.refundError, "Failed to refund checkout stock"),
              description: message,
              variant: "destructive",
            });
          } finally {
            setRefundBusyId(null);
          }
        })();
      });
    },
    [
      billListPaid,
      checkoutRefund,
      openShiftQuery.data?.id,
      outletId,
      runWithPin,
      t,
      toast,
    ],
  );

  useEffect(() => {
    setSheetTarget((prev) => {
      if (!prev) return prev;
      if (!prev.session) {
        if (activeGroupName && prev.groupName !== activeGroupName) {
          return { ...prev, groupName: activeGroupName };
        }
        return prev;
      }
      const list = openSessions.sessionsByTableId?.get(prev.table.id) ?? [];
      const live = list.find((s) => s.id === prev.session!.id) ?? null;
      const prevId = prev.session?.id ?? null;
      const liveId = live?.id ?? null;
      const prevUpdated = prev.session?.updated_at ?? null;
      const liveUpdated = live?.updated_at ?? null;
      if (prevId === liveId && prevUpdated === liveUpdated) {
        if (activeGroupName && prev.groupName !== activeGroupName) {
          return { ...prev, groupName: activeGroupName };
        }
        return prev;
      }
      return { ...prev, session: live, groupName: activeGroupName || prev.groupName };
    });
  }, [activeGroupName, openSessions.sessionsByTableId, openSessions.sessions]);

  const onSelectGroup = useCallback(
    (groupId: string) => {
      setSearchParams({ group: groupId }, { replace: true });
      setSheetOpen(false);
      setSheetTarget(null);
      setBillPickTable(null);
    },
    [setSearchParams],
  );

  const onSelectTable = useCallback(
    (table: PosTable) => {
      if (!outletId || !activeGroupId) return;
      const sessions = openSessions.sessionsByTableId?.get(table.id) ?? [];
      const occupancy = computeTableOccupancy(sessions, table.pax);
      if (occupancy.state === "empty") {
        setSheetTarget({
          table,
          groupName: activeGroupName,
          session: null,
        });
        setSheetOpen(true);
        return;
      }
      setBillPickTable(table);
    },
    [
      activeGroupId,
      activeGroupName,
      openSessions.sessionsByTableId,
      outletId,
    ],
  );

  const stashAndGoCashier = useCallback(
    (target: PosTableMapSheetTarget) => {
      if (!outletId) return;
      const { table, session } = target;
      const groupId = session?.group_id || table.group_id || activeGroupId;
      if (!groupId) return;
      stashPosSelectedTable({
        id: table.id,
        name: table.name,
        groupId,
        pax: table.pax,
        outletId,
        sessionId: session?.id ?? null,
        seatedAt: session?.seated_at ?? null,
        cartSnapshot: session?.cart_snapshot ?? null,
      });
      setSheetOpen(false);
      setBillListOpen(false);
      navigate(POS_AUTH_PATHS.cashier);
    },
    [activeGroupId, navigate, outletId],
  );

  const onViewOrder = useCallback(() => {
    if (!sheetTarget?.session) return;
    stashAndGoCashier(sheetTarget);
  }, [sheetTarget, stashAndGoCashier]);

  const onCreateOrder = useCallback(() => {
    if (!sheetTarget) return;
    stashAndGoCashier(sheetTarget);
  }, [sheetTarget, stashAndGoCashier]);

  const onPrintBill = useCallback(() => {
    if (!sheetTarget?.session || !outletId) return;
    const session = sheetTarget.session;
    const lines = session.cart_snapshot;
    if (lines.length === 0) {
      toast({
        title: t(POS_TABLE_MAP_I18N.sheetPrintError, "Print failed"),
        description: t(POS_TABLE_MAP_I18N.sheetEmptyBill, "No products on this bill"),
        variant: "destructive",
      });
      return;
    }
    runWithPin(POS_PIN_FEATURES.printBill, () => {
      void (async () => {
        setBusy(true);
        try {
          const subtotal = sumCustomerVisitCart(lines).total;
          await printPosReceiptBill({
            outletId,
            outletName,
            lines,
            checkoutTotals: draftTotalsFromCart(subtotal),
            isBillDraft: true,
          });
          toast({ title: t(POS_TABLE_MAP_I18N.sheetPrintSuccess, "Bill printed") });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (err instanceof PosPrinterUnavailableError || msg.includes("only available")) {
            toast({
              title: t(
                POS_SETTINGS_I18N.printerBluetoothUnavailable,
                "Bluetooth printers are only available in the Synckerja Android app.",
              ),
              variant: "destructive",
            });
          } else {
            toast({
              title: t(POS_TABLE_MAP_I18N.sheetPrintError, "Print failed"),
              description: msg,
              variant: "destructive",
            });
          }
        } finally {
          setBusy(false);
        }
      })();
    });
  }, [outletId, outletName, runWithPin, sheetTarget, t, toast]);

  const onDeleteBill = useCallback(() => {
    if (!sheetTarget?.session) return;
    setCancelReasonOpen(true);
  }, [sheetTarget?.session]);

  const onClearTable = useCallback(() => {
    if (!sheetTarget?.session) return;
    setClearConfirmOpen(true);
  }, [sheetTarget?.session]);

  const confirmClearTable = useCallback(() => {
    if (!sheetTarget?.session) return;
    const sessionId = sheetTarget.session.id;
    void (async () => {
      setBusy(true);
      try {
        await sessionMutations.clearSeatedOpenSession.mutateAsync({ sessionId });
        toast({ title: t(POS_TABLE_MAP_I18N.sheetClearSuccess, "Table cleared") });
        setClearConfirmOpen(false);
        setSheetOpen(false);
        setSheetTarget(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          title: t(POS_TABLE_MAP_I18N.sheetClearError, "Failed to clear table"),
          description: msg,
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    })();
  }, [sessionMutations.clearSeatedOpenSession, sheetTarget?.session, t, toast]);

  const confirmDeleteBill = useCallback(
    (reason: string) => {
      if (!sheetTarget?.session) return;
      const sessionId = sheetTarget.session.id;
      setCancelReasonOpen(false);
      runWithPin(POS_PIN_FEATURES.manageOpenBills, () => {
        void (async () => {
          setBusy(true);
          try {
            await sessionMutations.cancelOpen.mutateAsync({
              sessionId,
              reason,
              organizationId: organizationId ?? undefined,
              outletId: outletId ?? undefined,
            });
            toast({ title: t(POS_TABLE_MAP_I18N.sheetDeleteSuccess, "Bill deleted") });
            setSheetOpen(false);
            setSheetTarget(null);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast({
              title: t(POS_TABLE_MAP_I18N.sheetDeleteError, "Failed to delete bill"),
              description: msg,
              variant: "destructive",
            });
          } finally {
            setBusy(false);
          }
        })();
      });
    },
    [runWithPin, sessionMutations.cancelOpen, sheetTarget, t, toast, organizationId, outletId],
  );

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (permissions.isLoading) {
    return <PosTableMapSkeleton />;
  }

  if (!permissions.can("app.table_map")) {
    return (
      <Navigate
        to={resolvePosPostOutletPath({
          canCharge: permissions.canCharge(),
          canKitchenDisplay: permissions.canKitchenDisplay(),
        })}
        replace
      />
    );
  }

  const groupsLoading = groupsQuery.isLoading || orgLoading;
  const showSkeleton = groupsLoading && activeGroups.length === 0;

  if (showSkeleton) {
    return <PosTableMapSkeleton />;
  }

  const noGroups = !groupsLoading && activeGroups.length === 0;
  const tablesLoading =
    Boolean(activeGroupId) && (tablesQuery.isLoading || fixturesQuery.isLoading);
  const emptyTables = !tablesLoading && !noGroups && tables.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100">
      <PosTableMapHeader
        occupiedCount={
          billListOpenSessions.rows.length > 0
            ? billListOpenSessions.rows.length
            : openSessions.sessions.length
        }
        onOpenBillList={() => setBillListOpen(true)}
      />

      {noGroups ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            {t(POS_TABLE_MAP_I18N.needGroup, "No active table group for this outlet.")}
          </p>
          <p className="max-w-sm text-xs text-slate-500">
            {t(
              POS_TABLE_MAP_I18N.setupHint,
              "Set up the floor plan in Office → Table Management.",
            )}
          </p>
        </div>
      ) : (
        <PosTableMapCanvas
          tables={tables}
          fixtures={fixtures}
          selectedId={sheetTarget?.table.id ?? billPickTable?.id ?? null}
          sessionsByTableId={openSessions.sessionsByTableId}
          nowMs={nowMs}
          onSelect={onSelectTable}
          empty={emptyTables}
          loading={tablesLoading}
        />
      )}

      <PosTableMapFooter
        groups={activeGroups}
        activeGroupId={activeGroupId}
        onSelectGroup={onSelectGroup}
        outletLabel={outletName}
        onOpenMenu={() => setMenuOpen(true)}
        menuAriaLabel={t(POS_TABLE_MAP_I18N.menu, "Menu")}
      />

      <PosCashierMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        outletName={outletName}
        activeId="tableMap"
      />

      <PosSelectTableBillSheet
        open={Boolean(billPickTable)}
        onOpenChange={(next) => {
          if (!next) setBillPickTable(null);
        }}
        table={billPickTable}
        groupName={activeGroupName}
        occupancy={
          billPickTable
            ? computeTableOccupancy(
                openSessions.sessionsByTableId?.get(billPickTable.id) ?? [],
                billPickTable.pax,
              )
            : null
        }
        nowMs={nowMs}
        billRows={billListOpenSessions.rows}
        onResume={(session) => {
          if (!billPickTable) return;
          setSheetTarget({
            table: billPickTable,
            groupName: activeGroupName,
            session,
          });
          setBillPickTable(null);
          setSheetOpen(true);
        }}
        onNewBill={() => {
          if (!billPickTable) return;
          setSheetTarget({
            table: billPickTable,
            groupName: activeGroupName,
            session: null,
          });
          setBillPickTable(null);
          setSheetOpen(true);
        }}
      />

      <PosTableMapTableSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        target={sheetTarget}
        nowMs={nowMs}
        onViewOrder={onViewOrder}
        onCreateOrder={onCreateOrder}
        onPrintBill={onPrintBill}
        onDeleteBill={onDeleteBill}
        onClearTable={onClearTable}
        busy={busy}
      />
      <PosBillListDialog
        open={billListOpen}
        onOpenChange={setBillListOpen}
        openRows={billListOpenSessions.rows}
        cancelledRows={billListCancelled.data ?? []}
        paidRows={billListPaid.data ?? []}
        voids={lineVoids.voids}
        nowMs={nowMs}
        refundBusyId={refundBusyId}
        onNewBill={onNewBillFromList}
        onSelectOpen={onSelectOpenBill}
        onCancelOpen={setCancelTarget}
        onFulfillOpen={onFulfillOpenBill}
        onRefundPaid={onRefundPaidBill}
        showFulfillAction={stockCommitPoint === "fulfillment"}
      />
      <PosBillReasonDialog
        open={cancelReasonOpen}
        onOpenChange={setCancelReasonOpen}
        title={t(POS_BILL_LIST_I18N.cancelReasonTitle, "Reason for cancelling bill")}
        onConfirm={confirmDeleteBill}
        confirming={busy}
      />
      <PosBillReasonDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t(POS_BILL_LIST_I18N.cancelReasonTitle, "Reason for cancelling bill")}
        onConfirm={confirmCancelFromList}
        confirming={busy}
      />
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(POS_TABLE_MAP_I18N.sheetClearTable, "Clear table")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                POS_TABLE_MAP_I18N.sheetConfirmClear,
                "Clear this table? The dining session will close. Payment is not refunded.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t(POS_TABLE_MAP_I18N.sheetClose, "Close")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                confirmClearTable();
              }}
            >
              {t(POS_TABLE_MAP_I18N.sheetClearTable, "Clear table")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {pinDialog}
    </div>
  );
}
