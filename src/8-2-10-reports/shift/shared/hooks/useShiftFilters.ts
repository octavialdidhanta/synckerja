import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useReportsSalesPeriodFilters } from "../../../shared/hooks/useReportsSalesPeriodFilters";

const STAFF_ALL = "all";

export function useShiftFilters() {
  const period = useReportsSalesPeriodFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const staffUserId = searchParams.get("staff")?.trim() || STAFF_ALL;

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setStaffUserId = useCallback(
    (next: string) => {
      patchParams({ staff: next === STAFF_ALL ? null : next });
    },
    [patchParams],
  );

  const openedByForQuery =
    staffUserId === STAFF_ALL ? null : staffUserId;

  return {
    ...period,
    staffUserId,
    setStaffUserId,
    openedByForQuery,
    staffFilterAll: STAFF_ALL,
  };
}
