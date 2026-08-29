import { useMemo } from "react";
import { usePosTableGroups } from "@/8-2-9-table-management/hooks/usePosTableGroups";

/**
 * Active table groups for the selected POS outlet (read-only floor plan).
 * Inactive / deleted groups are excluded from chips.
 */
export function usePosMobileTableGroups(outletId: string | null | undefined) {
  const query = usePosTableGroups(outletId);

  const activeGroups = useMemo(
    () => (query.groups ?? []).filter((g) => g.is_active && !g.is_deleted),
    [query.groups],
  );

  return {
    ...query,
    activeGroups,
  };
}
