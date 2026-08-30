import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { usePosOpenTableSessions } from "@/8-2-9-table-management/hooks/usePosTableSessions";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import {
  computeTableOccupancy,
  type TableOccupancy,
} from "@/8-2-9-table-management/sessions";
import { usePosMobileFloorFixtures } from "@/pos-mobile/5-table-map/hooks/usePosMobileFloorFixtures";
import { usePosMobileTableGroups } from "@/pos-mobile/5-table-map/hooks/usePosMobileTableGroups";
import { usePosMobileTables } from "@/pos-mobile/5-table-map/hooks/usePosMobileTables";
import { usePosBillListOpenSessions } from "../../hooks/usePosBillListSessions";
import { POS_SELECT_TABLE_I18N } from "../../lib/posSelectTableCopy";
import { PosSelectTableBillSheet } from "./PosSelectTableBillSheet";
import { PosSelectTableGroupTabs } from "./PosSelectTableGroupTabs";
import { PosSelectTableMap } from "./PosSelectTableMap";

export type PosSelectTablePick = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  /** Default / suggested pax for New Bill (clamped to maxPax). */
  pax: number;
  /** Max pax allowed for a new bill on this table (remaining capacity). */
  maxPax: number;
};

type Props = {
  open: boolean;
  outletId: string;
  initialTableId?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onSaveAsBill: () => void;
  onContinue: (pick: PosSelectTablePick) => void;
  /** Resume an existing open bill (replaces current cart like bill list). */
  onResumeSession?: (session: PosTableSession) => void;
};

export function PosSelectTableOverlay({
  open,
  outletId,
  initialTableId = null,
  busy,
  onCancel,
  onSaveAsBill,
  onContinue,
  onResumeSession,
}: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const groupsQuery = usePosMobileTableGroups(outletId);
  const activeGroups = groupsQuery.activeGroups;
  const openSessions = usePosOpenTableSessions(outletId);
  const billListOpenSessions = usePosBillListOpenSessions(outletId);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedMaxPax, setSelectedMaxPax] = useState<number | null>(null);
  const [billSheetTable, setBillSheetTable] = useState<PosTable | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const first = activeGroups[0]?.id ?? null;
    const fromInitial = initialTableId
      ? openSessions.sessions.find((s) => s.pos_table_id === initialTableId)
          ?.group_id
      : null;
    setActiveGroupId(fromInitial || first);
    setSelectedTableId(initialTableId);
    setSelectedMaxPax(null);
    setBillSheetTable(null);
  }, [open, activeGroups, initialTableId, openSessions.sessions]);

  useEffect(() => {
    if (!open) return;
    if (activeGroupId && activeGroups.some((g) => g.id === activeGroupId)) return;
    setActiveGroupId(activeGroups[0]?.id ?? null);
  }, [open, activeGroupId, activeGroups]);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  const tablesQuery = usePosMobileTables(activeGroupId);
  const fixturesQuery = usePosMobileFloorFixtures(activeGroupId);
  const tables = tablesQuery.tables ?? [];
  const fixtures = fixturesQuery.fixtures ?? [];
  const sessionsByTableId = useMemo(
    () => openSessions.sessionsByTableId ?? new Map<string, PosTableSession[]>(),
    [openSessions.sessionsByTableId],
  );
  const mapLoading =
    Boolean(activeGroupId) &&
    (tablesQuery.isLoading || fixturesQuery.isLoading);

  const tableCounts = useQuery({
    queryKey: ["pos-tables", "group-counts", organizationId, outletId],
    enabled: Boolean(open && organizationId && outletId),
    queryFn: async (): Promise<Map<string, number>> => {
      if (!organizationId || !outletId) return new Map();
      const { data, error } = await supabase
        .from("pos_tables")
        .select("id, group_id")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("is_deleted", false);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const gid = String(row.group_id);
        map.set(gid, (map.get(gid) ?? 0) + 1);
      }
      return map;
    },
  });

  useEffect(() => {
    if (!open || !initialTableId || !organizationId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("pos_tables")
        .select("group_id")
        .eq("id", initialTableId)
        .maybeSingle();
      if (cancelled || !data?.group_id) return;
      setActiveGroupId(String(data.group_id));
      setSelectedTableId(initialTableId);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialTableId, organizationId]);

  const openBillCountByGroupId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of openSessions.sessions) {
      if (!s.group_id || !s.pos_table_id) continue;
      map.set(s.group_id, (map.get(s.group_id) ?? 0) + 1);
    }
    return map;
  }, [openSessions.sessions]);

  const selectedTable = useMemo(
    () => tables.find((row) => row.id === selectedTableId) ?? null,
    [tables, selectedTableId],
  );

  const hasSelection = Boolean(selectedTable);
  const activeGroupName =
    activeGroups.find((g) => g.id === activeGroupId)?.name ?? "";

  const billSheetOccupancy = useMemo((): TableOccupancy | null => {
    if (!billSheetTable) return null;
    const sessions = sessionsByTableId.get(billSheetTable.id) ?? [];
    return computeTableOccupancy(sessions, billSheetTable.pax);
  }, [billSheetTable, sessionsByTableId]);

  const selectEmptyTable = (table: PosTable, occupancy: TableOccupancy) => {
    setSelectedTableId(table.id);
    setSelectedMaxPax(occupancy.remainingPax);
  };

  const onTapTable = (table: PosTable, occupancy: TableOccupancy) => {
    if (occupancy.state === "empty") {
      selectEmptyTable(table, occupancy);
      return;
    }
    setBillSheetTable(table);
  };

  const continueWithTable = (table: PosTable, maxPax: number) => {
    if (!activeGroupId) return;
    const clampedMax = Math.max(1, maxPax);
    onContinue({
      id: table.id,
      name: table.name,
      groupId: activeGroupId,
      groupName: activeGroupName,
      pax: Math.min(table.pax, clampedMax),
      maxPax: clampedMax,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-100">
      <header className="relative flex items-center justify-center border-b border-slate-200 bg-white px-3 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
          onClick={onCancel}
          disabled={busy}
        >
          {t(POS_SELECT_TABLE_I18N.cancel, "Cancel")}
        </Button>
        <h1 className="text-base font-semibold text-slate-900">
          {t(POS_SELECT_TABLE_I18N.title, "Select Table")}
        </h1>
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {!hasSelection ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-primary text-primary"
              onClick={onSaveAsBill}
              disabled={busy}
            >
              {t(POS_SELECT_TABLE_I18N.saveAsBill, "Save as Bill")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!hasSelection || busy}
            onClick={() => {
              if (!selectedTable) return;
              const sessions = sessionsByTableId.get(selectedTable.id) ?? [];
              const occ = computeTableOccupancy(sessions, selectedTable.pax);
              continueWithTable(
                selectedTable,
                selectedMaxPax ?? occ.remainingPax,
              );
            }}
          >
            {t(POS_SELECT_TABLE_I18N.continue, "Continue")}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeGroups.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-500">
            {t(
              POS_SELECT_TABLE_I18N.needGroup,
              "No active table group for this outlet.",
            )}
          </p>
        ) : (
          <PosSelectTableMap
            tables={tables}
            fixtures={fixtures}
            sessionsByTableId={sessionsByTableId}
            selectedTableId={selectedTableId}
            loading={mapLoading}
            onSelect={onTapTable}
          />
        )}
      </div>

      <PosSelectTableGroupTabs
        groups={activeGroups}
        activeGroupId={activeGroupId}
        occupiedByGroupId={openBillCountByGroupId}
        tableCountByGroupId={tableCounts.data ?? new Map()}
        onSelectGroup={(groupId) => {
          setActiveGroupId(groupId);
          setSelectedTableId(null);
          setSelectedMaxPax(null);
          setBillSheetTable(null);
        }}
      />

      <PosSelectTableBillSheet
        open={Boolean(billSheetTable)}
        onOpenChange={(next) => {
          if (!next) setBillSheetTable(null);
        }}
        table={billSheetTable}
        groupName={activeGroupName}
        occupancy={billSheetOccupancy}
        nowMs={nowMs}
        billRows={billListOpenSessions.rows}
        onResume={(session) => {
          setBillSheetTable(null);
          onResumeSession?.(session);
        }}
        onNewBill={() => {
          if (!billSheetTable || !billSheetOccupancy) return;
          const table = billSheetTable;
          const maxPax = billSheetOccupancy.remainingPax;
          setBillSheetTable(null);
          setSelectedTableId(table.id);
          setSelectedMaxPax(maxPax);
          continueWithTable(table, maxPax);
        }}
      />
    </div>
  );
}
