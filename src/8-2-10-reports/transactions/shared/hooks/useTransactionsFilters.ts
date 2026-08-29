import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useReportsSalesPeriodFilters } from "../../../shared/hooks/useReportsSalesPeriodFilters";
import { parseTransactionsTab, type TransactionsTabId } from "../../layout/transactionsTabs";

/** URL-synced outlet, date range, receipt search, and tab for Transactions report. */
export function useTransactionsFilters() {
  const period = useReportsSalesPeriodFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = parseTransactionsTab(searchParams.get("tab"));
  const receiptQuery = searchParams.get("q")?.trim() ?? "";

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

  const setTab = useCallback(
    (next: TransactionsTabId) => {
      patchParams({ tab: next === "success" ? null : next });
    },
    [patchParams],
  );

  const setReceiptQuery = useCallback(
    (next: string) => {
      patchParams({ q: next.trim() || null });
    },
    [patchParams],
  );

  return {
    ...period,
    tab,
    setTab,
    receiptQuery,
    setReceiptQuery,
  };
}
