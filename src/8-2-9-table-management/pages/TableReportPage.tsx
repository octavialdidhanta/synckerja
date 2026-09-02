import { useMemo, useState } from "react";
import { getLocalDateYmd } from "@/shared/lib/date/getLocalDateYmd";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { cn } from "@/shared/lib/utils";
import { TableManagementModuleShell } from "../layout/TableManagementModuleShell";
import { TableManagementWorkspace } from "../layout/TableManagementWorkspace";
import { TableReportFilters } from "../components/report/TableReportFilters";
import { TableReportSummary } from "../components/report/TableReportSummary";
import { TableReportTransactionTable } from "../components/report/TableReportTransactionTable";
import { TableReportVoidPanel } from "../components/report/TableReportVoidPanel";
import { TableReportOrderDetail } from "../components/report/TableReportOrderDetail";
import {
  usePosTableReport,
  usePosTableReportTableOptions,
  type PosTableReportRow,
} from "../hooks/usePosTableReport";
import { TableReportSkeleton } from "./TableReportSkeleton";

type TabId = "transaction" | "void";

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateYmd(d);
}

export default function TableReportPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { selectedOutletId, setSelectedOutletId, isLoading: outletsLoading } =
    useSelectedPosOutlet(true);

  const [dateFrom, setDateFrom] = useState(() => daysAgoYmd(30));
  const [dateTo, setDateTo] = useState(() => getLocalDateYmd());
  const [tableKey, setTableKey] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("transaction");
  const [selected, setSelected] = useState<PosTableReportRow | null>(null);

  const filters = useMemo(
    () => ({
      outletId: selectedOutletId || null,
      dateFrom,
      dateTo,
      tableKey,
    }),
    [selectedOutletId, dateFrom, dateTo, tableKey],
  );

  const report = usePosTableReport(filters);
  const tableOpts = usePosTableReportTableOptions({
    outletId: selectedOutletId || null,
    dateFrom,
    dateTo,
  });

  const dataPending =
    orgBootstrapPending ||
    outletsLoading ||
    (Boolean(selectedOutletId) && report.isLoading);
  const showContent = useDebouncedReady(!dataPending, 150);

  const perTableHint = useMemo(() => {
    if (!tableKey || report.summary.byTable.length === 0) return null;
    const entry = report.summary.byTable.find(([k]) => k === tableKey);
    if (!entry) return null;
    const [, stats] = entry;
    const avg =
      stats.durationN > 0 ? Math.round(stats.durationSum / stats.durationN) : null;
    return { label: stats.label, count: stats.count, avg };
  }, [report.summary.byTable, tableKey]);

  return (
    <TableManagementModuleShell
      showContent={showContent}
      loadingSkeleton={<TableReportSkeleton />}
    >
      <TableManagementWorkspace count={tab === "transaction" ? report.rows.length : 0}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-12 gap-2 overflow-hidden p-4">
            <div className={cn("col-span-12 flex min-h-0 flex-col gap-3 overflow-hidden", selected ? "xl:col-span-8" : "")}>
              <div className="flex-shrink-0">
                <h2 className="text-lg font-semibold">
                  {t("tableManagement.report.title", "Table Report")}
                </h2>
                <div className="mt-2">
                  <TableReportFilters
                    outletId={selectedOutletId || ""}
                    onOutletChange={(id) => {
                      setSelectedOutletId(id);
                      setSelected(null);
                      setTableKey(null);
                    }}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    tableKey={tableKey}
                    onTableKeyChange={(v) => {
                      setTableKey(v);
                      setSelected(null);
                    }}
                    tableOptions={tableOpts.data ?? []}
                  />
                </div>
              </div>

              <div className="flex flex-shrink-0 gap-4 border-b border-border text-sm">
                <button
                  type="button"
                  className={cn(
                    "border-b-2 px-1 pb-2 font-medium transition-colors",
                    tab === "transaction"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab("transaction")}
                >
                  {t("tableManagement.report.tabTransaction", "Transaction")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "border-b-2 px-1 pb-2 font-medium transition-colors",
                    tab === "void"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab("void")}
                >
                  {t("tableManagement.report.tabVoid", "Void Items")}
                </button>
              </div>

              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tab === "transaction" ? (
                  <>
                    <TableReportSummary
                      completed={report.summary.completed}
                      cancelled={report.summary.cancelled}
                    />
                    {perTableHint ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t(
                          "tableManagement.report.perTableHint",
                          "{{table}}: {{count}} orders · avg duration {{avg}}",
                          {
                            table: perTableHint.label,
                            count: perTableHint.count,
                            avg:
                              perTableHint.avg != null ? `${perTableHint.avg} Min` : "—",
                          },
                        )}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <TableReportTransactionTable
                        rows={report.rows}
                        selectedId={selected?.id ?? null}
                        onSelect={setSelected}
                      />
                    </div>
                  </>
                ) : (
                  <TableReportVoidPanel />
                )}
              </div>
            </div>

            {selected && tab === "transaction" ? (
              <div className="col-span-12 min-h-[320px] xl:col-span-4">
                <TableReportOrderDetail row={selected} onClose={() => setSelected(null)} />
              </div>
            ) : null}
          </div>
        </div>
      </TableManagementWorkspace>
    </TableManagementModuleShell>
  );
}
