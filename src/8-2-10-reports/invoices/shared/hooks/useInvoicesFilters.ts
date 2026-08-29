import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useReportsSalesPeriodFilters } from "../../../shared/hooks/useReportsSalesPeriodFilters";
import { parseInvoiceStatusFilter, type InvoiceStatusFilter } from "../../layout/invoiceStatus";

export function useInvoicesFilters() {
  const period = useReportsSalesPeriodFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = parseInvoiceStatusFilter(searchParams.get("status"));
  const searchQuery = searchParams.get("q")?.trim() ?? "";

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

  const setStatusFilter = useCallback(
    (next: InvoiceStatusFilter) => {
      patchParams({ status: next === "all" ? null : next });
    },
    [patchParams],
  );

  const setSearchQuery = useCallback(
    (next: string) => {
      patchParams({ q: next.trim() || null });
    },
    [patchParams],
  );

  return {
    ...period,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
  };
}
