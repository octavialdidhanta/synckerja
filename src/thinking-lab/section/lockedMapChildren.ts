import type { LabBigThought } from "@/thinking-lab/big-thought/types";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";
import type { MasterMapChild } from "@/thinking-lab/section/MasterThoughtMapTree";

export function buildLockedMapChildren(input: {
  lockedRows: LabBigThought[];
  selected: LabMasterThought | null;
  selectedRows: LabBigThought[] | undefined;
}): Map<string, MasterMapChild[]> {
  const grouped = new Map<string, LabBigThought[]>();
  for (const row of input.lockedRows) {
    if (row.status !== "locked") continue;
    const list = grouped.get(row.masterThoughtId) ?? [];
    list.push(row);
    grouped.set(row.masterThoughtId, list);
  }
  if (input.selected && input.selectedRows) {
    if (input.selected.mtStatus === "locked") {
      grouped.set(
        input.selected.id,
        input.selectedRows.filter((row) => row.status === "locked"),
      );
    } else {
      grouped.delete(input.selected.id);
    }
  }
  const map = new Map<string, MasterMapChild[]>();
  for (const [masterId, rows] of grouped) {
    const children = [...rows]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => ({ id: row.id, code: row.code, label: row.label, statement: row.statement }));
    map.set(masterId, children);
  }
  return map;
}
