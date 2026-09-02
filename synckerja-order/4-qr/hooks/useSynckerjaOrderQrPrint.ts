import { useCallback, useEffect, useMemo, useState } from "react";
import type { QrTableInput } from "../lib/qrPrintTypes";

export function useSynckerjaOrderQrPrint(tables: QrTableInput[]) {
  const tableIdsKey = useMemo(() => tables.map((t) => t.id).join("|"), [tables]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewTableId, setPreviewTableId] = useState<string | null>(null);

  useEffect(() => {
    const ids = tableIdsKey ? tableIdsKey.split("|") : [];
    setSelectedIds(new Set(ids));
    setPreviewTableId(ids[0] ?? null);
  }, [tableIdsKey]);

  const toggleTable = useCallback((tableId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tableId);
      else next.delete(tableId);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (checked: boolean) => {
      const ids = tableIdsKey ? tableIdsKey.split("|") : [];
      setSelectedIds(checked ? new Set(ids) : new Set());
    },
    [tableIdsKey],
  );

  const selectedTables = useMemo(
    () => tables.filter((t) => selectedIds.has(t.id)),
    [tables, selectedIds],
  );

  const previewTable = useMemo(() => {
    if (previewTableId) {
      const found = tables.find((t) => t.id === previewTableId);
      if (found) return found;
    }
    return selectedTables[0] ?? tables[0] ?? null;
  }, [previewTableId, selectedTables, tables]);

  const print = useCallback(() => {
    window.print();
  }, []);

  return {
    selectedIds,
    selectedTables,
    previewTable,
    setPreviewTableId,
    toggleTable,
    selectAll,
    allSelected:
      tableIdsKey.length > 0 &&
      selectedIds.size === (tableIdsKey ? tableIdsKey.split("|").length : 0),
    print,
  };
}
