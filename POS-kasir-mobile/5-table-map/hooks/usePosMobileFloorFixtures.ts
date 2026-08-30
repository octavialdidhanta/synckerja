import { usePosFloorFixtures } from "@/8-2-9-table-management/fixtures";

/** Floor fixtures for a table group — same source as Office Table Map editor. */
export function usePosMobileFloorFixtures(groupId: string | null | undefined) {
  return usePosFloorFixtures(groupId);
}
