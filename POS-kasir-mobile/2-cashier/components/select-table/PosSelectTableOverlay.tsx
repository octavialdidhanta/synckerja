import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { usePosOpenTableSessions } from "@/8-2-9-table-management/hooks/usePosTableSessions";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import { usePosMobileTableGroups } from "@/pos-mobile/5-table-map/hooks/usePosMobileTableGroups";
import { usePosMobileTables } from "@/pos-mobile/5-table-map/hooks/usePosMobileTables";
import { POS_SELECT_TABLE_I18N } from "../../lib/posSelectTableCopy";
import { PosSelectTableGrid } from "./PosSelectTableGrid";
import { PosSelectTableGroupTabs } from "./PosSelectTableGroupTabs";

export type PosSelectTablePick = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  pax: number;
};

type Props = {
  open: boolean;
  outletId: string;
  /** Pre-select when cashier already had a table. */
  initialTableId?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onSaveAsBill: () => void;
  onContinue: (pick: PosSelectTablePick) => void;
};

export function PosSelectTableOverlay({
  open,
  outletId,
  initialTableId = null,
  busy,
  onCancel,
  onSaveAsBill,
  onContinue,
}: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const groupsQuery = usePosMobileTableGroups(outletId);
  const activeGroups = groupsQuery.activeGroups;
  const openSessions = usePosOpenTableSessions(outletId);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const first = activeGroups[0]?.id ?? null;
    const fromInitial = initialTableId
      ? openSessions.sessions.find((s) => s.pos_table_id === initialTableId)?.group_id
      : null;
    // Prefer group of preselected vacant table via tables query after load — start with first group.
    setActiveGroupId(fromInitial || first);
    setSelectedTableId(initialTableId);
  }, [open, activeGroups, initialTableId, openSessions.sessions]);

  useEffect(() => {
    if (!open) return;
    if (activeGroupId && activeGroups.some((g) => g.id === activeGroupId)) return;
    setActiveGroupId(activeGroups[0]?.id ?? null);
  }, [open, activeGroupId, activeGroups]);

  const tablesQuery = usePosMobileTables(activeGroupId);
  const tables = tablesQuery.tables ?? [];

  // If initial table is in another group, switch when we discover it among loaded tables is insufficient —
  // resolve group from all tables count query below when selecting initial.
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

  // Resolve initial table's group from counts query raw — fetch one table if needed
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

  const occupiedByGroupId = useMemo(() => {
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

  const onSelectTable = (table: PosTable) => {
    setSelectedTableId(table.id);
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
              if (!selectedTable || !activeGroupId) return;
              onContinue({
                id: selectedTable.id,
                name: selectedTable.name,
                groupId: activeGroupId,
                groupName: activeGroupName,
                pax: selectedTable.pax,
              });
            }}
          >
            {t(POS_SELECT_TABLE_I18N.continue, "Continue")}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeGroups.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-slate-500">
            {t(POS_SELECT_TABLE_I18N.needGroup, "No active table group for this outlet.")}
          </p>
        ) : (
          <PosSelectTableGrid
            tables={tables}
            sessionsByTableId={openSessions.byTableId}
            selectedTableId={selectedTableId}
            allowOccupiedTableId={initialTableId}
            onSelect={onSelectTable}
          />
        )}
      </div>

      <PosSelectTableGroupTabs
        groups={activeGroups}
        activeGroupId={activeGroupId}
        occupiedByGroupId={occupiedByGroupId}
        tableCountByGroupId={tableCounts.data ?? new Map()}
        onSelectGroup={(groupId) => {
          setActiveGroupId(groupId);
          setSelectedTableId(null);
        }}
      />
    </div>
  );
}
