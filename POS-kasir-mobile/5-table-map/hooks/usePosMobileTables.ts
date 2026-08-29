import { usePosTables } from "@/8-2-9-table-management/hooks/usePosTables";

/** Tables for a table group — same source as Office Table Map editor. */
export function usePosMobileTables(groupId: string | null | undefined) {
  return usePosTables(groupId);
}
