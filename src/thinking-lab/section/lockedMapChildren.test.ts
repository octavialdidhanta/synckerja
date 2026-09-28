import { describe, expect, it } from "vitest";
import type { LabBigThought } from "@/thinking-lab/big-thought/types";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";
import { buildLockedMapChildren } from "@/thinking-lab/section/lockedMapChildren";

function thought(partial: Partial<LabBigThought> & Pick<LabBigThought, "id" | "masterThoughtId" | "status">): LabBigThought {
  return {
    organizationId: "org",
    code: partial.code ?? partial.id,
    label: partial.label ?? "",
    statement: partial.statement ?? partial.id,
    sortOrder: partial.sortOrder ?? 0,
    canonicalSemantic: null,
    semanticFingerprint: null,
    ...partial,
  };
}

const selected = {
  id: "master-1",
  mtStatus: "locked",
} as LabMasterThought;

describe("buildLockedMapChildren", () => {
  it("nests locked big thoughts under their master", () => {
    const map = buildLockedMapChildren({
      lockedRows: [
        thought({ id: "b", masterThoughtId: "master-1", status: "locked", code: "BT02", sortOrder: 2 }),
        thought({ id: "a", masterThoughtId: "master-1", status: "locked", code: "BT01", sortOrder: 1 }),
        thought({ id: "c", masterThoughtId: "master-2", status: "locked", code: "BT01", sortOrder: 1 }),
      ],
      selected: null,
      selectedRows: undefined,
    });
    expect(map.get("master-1")?.map((row) => row.code)).toEqual(["BT01", "BT02"]);
    expect(map.get("master-2")?.map((row) => row.code)).toEqual(["BT01"]);
  });

  it("uses the selected master's live locked rows as soon as lock lands", () => {
    const map = buildLockedMapChildren({
      lockedRows: [],
      selected,
      selectedRows: [
        thought({ id: "a", masterThoughtId: "master-1", status: "locked", code: "BT01", sortOrder: 1, statement: "why" }),
        thought({ id: "x", masterThoughtId: "master-1", status: "candidate", code: "BT09", sortOrder: 9 }),
      ],
    });
    expect(map.get("master-1")).toEqual([{ id: "a", code: "BT01", label: "", statement: "why" }]);
  });

  it("drops children when the selected master is unlocked", () => {
    const map = buildLockedMapChildren({
      lockedRows: [thought({ id: "a", masterThoughtId: "master-1", status: "locked", code: "BT01" })],
      selected: { ...selected, mtStatus: "confirmed" },
      selectedRows: [thought({ id: "a", masterThoughtId: "master-1", status: "candidate", code: "BT01" })],
    });
    expect(map.has("master-1")).toBe(false);
  });
});
