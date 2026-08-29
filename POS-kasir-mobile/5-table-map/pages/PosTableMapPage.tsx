import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
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
import { PosBillReasonDialog } from "@/pos-mobile/2-cashier/components/bill-list";
import { POS_BILL_LIST_I18N } from "@/pos-mobile/2-cashier/lib/posBillListCopy";
import { usePosPinGate } from "@/pos-mobile/shared/hooks/usePosPinGate";
import { POS_PIN_FEATURES } from "@/pos-mobile/shared/lib/posPinFeatures";
import { printPosReceiptBill } from "@/pos-mobile/shared/printing/posPrintService";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { POS_SETTINGS_I18N } from "@/pos-mobile/3-settings/lib/posSettingsCopy";
import { PosTableMapCanvas } from "../components/PosTableMapCanvas";
import { PosTableMapFooter } from "../components/PosTableMapFooter";
import { PosTableMapHeader } from "../components/PosTableMapHeader";
import {
  PosTableMapTableSheet,
  type PosTableMapSheetTarget,
} from "../components/PosTableMapTableSheet";
import {
  PosTableMapBillListSheet,
  type PosTableMapBillListItem,
} from "../components/PosTableMapBillListSheet";
import { usePosMobileTableGroups } from "../hooks/usePosMobileTableGroups";
import { usePosMobileTables } from "../hooks/usePosMobileTables";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";
import { stashPosSelectedTable } from "../lib/posSelectedTableStorage";
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

function tableFromSession(session: PosTableSession): PosTable {
  return {
    id: session.pos_table_id ?? session.id,
    organization_id: session.organization_id,
    outlet_id: session.outlet_id,
    group_id: session.group_id ?? "",
    name: session.table_name,
    shape: "rectangle",
    pax: session.pax,
    grid_x: 0,
    grid_y: 0,
    grid_w: 1,
    grid_h: 1,
    rotation: 0,
    is_deleted: false,
    deleted_at: null,
    created_at: session.created_at,
    updated_at: session.updated_at,
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

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const outletName = outletMeta?.name || "";
  const { runWithPin, pinDialog } = usePosPinGate(outletId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<PosTableMapSheetTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [billListOpen, setBillListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const groupsQuery = usePosMobileTableGroups(outletId);
  const activeGroups = groupsQuery.activeGroups;
  const openSessions = usePosOpenTableSessions(outletId);
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
  const tables = tablesQuery.tables ?? [];

  const billListItems = useMemo((): PosTableMapBillListItem[] => {
    const groupNameById = new Map(activeGroups.map((g) => [g.id, g.name]));
    return openSessions.sessions
      .filter((session) => Boolean(session.pos_table_id))
      .map((session) => ({
        session,
        groupName: session.group_id
          ? (groupNameById.get(session.group_id) ?? "—")
          : "—",
      }));
  }, [activeGroups, openSessions.sessions]);

  const onSelectBillFromList = useCallback(
    (item: PosTableMapBillListItem) => {
      const { session, groupName } = item;
      if (!session.pos_table_id || !session.group_id) return;
      if (session.group_id !== activeGroupId) {
        setSearchParams({ group: session.group_id }, { replace: true });
      }
      const fromCanvas = tables.find((row) => row.id === session.pos_table_id);
      setSheetTarget({
        table: fromCanvas ?? tableFromSession(session),
        groupName,
        session,
      });
      setBillListOpen(false);
      setSheetOpen(true);
    },
    [activeGroupId, setSearchParams, tables],
  );

  useEffect(() => {
    setSheetTarget((prev) => {
      if (!prev) return prev;
      const live = openSessions.byTableId.get(prev.table.id) ?? null;
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
  }, [activeGroupName, openSessions.byTableId, openSessions.sessions]);

  const onSelectGroup = useCallback(
    (groupId: string) => {
      setSearchParams({ group: groupId }, { replace: true });
      setSheetOpen(false);
      setSheetTarget(null);
    },
    [setSearchParams],
  );

  const onSelectTable = useCallback(
    (table: PosTable, session: PosTableSession | null) => {
      if (!outletId || !activeGroupId) return;
      setSheetTarget({
        table,
        groupName: activeGroupName,
        session,
      });
      setSheetOpen(true);
    },
    [activeGroupId, activeGroupName, outletId],
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

  const groupsLoading = groupsQuery.isLoading || orgLoading;
  const showSkeleton = groupsLoading && activeGroups.length === 0;

  if (showSkeleton) {
    return <PosTableMapSkeleton />;
  }

  const noGroups = !groupsLoading && activeGroups.length === 0;
  const tablesLoading = Boolean(activeGroupId) && tablesQuery.isLoading;
  const emptyTables = !tablesLoading && !noGroups && tables.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100">
      <PosTableMapHeader
        occupiedCount={openSessions.sessions.length}
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
          selectedId={sheetTarget?.table.id ?? null}
          sessionsByTableId={openSessions.byTableId}
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

      <PosTableMapTableSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        target={sheetTarget}
        nowMs={nowMs}
        onViewOrder={onViewOrder}
        onCreateOrder={onCreateOrder}
        onPrintBill={onPrintBill}
        onDeleteBill={onDeleteBill}
        busy={busy}
      />
      <PosTableMapBillListSheet
        open={billListOpen}
        onOpenChange={setBillListOpen}
        items={billListItems}
        nowMs={nowMs}
        onSelect={onSelectBillFromList}
      />
      <PosBillReasonDialog
        open={cancelReasonOpen}
        onOpenChange={setCancelReasonOpen}
        title={t(POS_BILL_LIST_I18N.cancelReasonTitle, "Reason for cancelling bill")}
        onConfirm={confirmDeleteBill}
        confirming={busy}
      />
      {pinDialog}
    </div>
  );
}
