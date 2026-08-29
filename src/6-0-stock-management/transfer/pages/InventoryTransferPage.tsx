import { useMemo, useState } from "react";
import { endOfDay, format, startOfDay } from "date-fns";
import { toast } from "sonner";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useTransferWorkflowMode } from "@/6-0-stock-management/hooks/useCatalogInventoryWorkflowModes";
import { useInventoryFeatureAccessCheck } from "@/8-2-5-inventory-settings/hooks/useInventoryFeatureAccess";
import { InventoryTransferSkeleton } from "../skeletons/InventoryTransferSkeleton";
import { TransfersToolbar } from "../components/TransfersToolbar";
import { TransfersTable } from "../components/TransfersTable";
import { CreateTransferDialog } from "../components/CreateTransferDialog";
import { TransferDetailPanel } from "../components/TransferDetailPanel";
import { useStockTransfersQuery } from "../hooks/useStockTransfersQuery";
import { exportTransfersXlsx } from "../lib/exportTransfersXlsx";
import { filterTransferRows } from "../lib/transferHelpers";
import type { TransferKindFilter, StockTransferListRow, StockTransferStatusFilter } from "../types";

export function InventoryTransferPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId: orgId } = useOrgBootstrapPending();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const {
    selectedOutletId,
    setSelectedOutletId,
    outlets,
    isLoading: outletLoading,
  } = useSelectedPosOutlet(true, { allowAll: true });

  const { transferMode } = useTransferWorkflowMode();
  const transferRequestAccess = useInventoryFeatureAccessCheck(
    transferMode === "advanced" ? "transfer_request" : null,
  );

  const [kind, setKind] = useState<TransferKindFilter>("item_library");
  const [status, setStatus] = useState<StockTransferStatusFilter>("all");
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [to, setTo] = useState(() => endOfDay(new Date()));
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  const query = useStockTransfersQuery({
    organizationId: orgId,
    outletId: selectedOutletId,
    kind,
    status: transferMode === "advanced" ? status : "all",
    from,
    to,
  });

  const dataPending = orgBootstrapPending || gatePending || outletLoading || query.isLoading;
  const showContent = useDebouncedReady(!dataPending, 180);
  const allRows = query.data ?? [];
  const rows = useMemo(() => filterTransferRows(allRows, search), [allRows, search]);
  const activeOutlets = useMemo(() => outlets.filter((outlet) => outlet.is_active), [outlets]);
  const hasMultipleOutlets = activeOutlets.length > 1;
  const transferCreateBlockedByRole =
    transferMode === "advanced" &&
    (transferRequestAccess.isLoading || transferRequestAccess.data === false);
  const createDisabled = !canManage || !hasMultipleOutlets || transferCreateBlockedByRole;
  const createDisabledReason =
    transferMode === "advanced" && transferRequestAccess.data === false
      ? t(
          "operations.inventory.transfer.noFeatureAccess",
          "You do not have Transfer Request access. Ask an admin to assign it in Inventory Settings.",
        )
      : undefined;

  const createFromOutletId = useMemo(() => {
    if (selectedOutletId && selectedOutletId !== POS_OUTLET_FILTER_ALL) {
      if (activeOutlets.some((outlet) => outlet.id === selectedOutletId)) return selectedOutletId;
    }
    return activeOutlets[0]?.id ?? "";
  }, [selectedOutletId, activeOutlets]);

  const filename = useMemo(() => `transfers-${format(new Date(), "yyyy-MM-dd")}.xlsx`, []);

  const openDetail = (row: StockTransferListRow) => {
    setSelectedTransferId(row.id);
    setDetailOpen(true);
  };

  if (!showContent) return <InventoryTransferSkeleton />;

  return (
    <>
      <StockManagementModuleShell>
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
          <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <TransfersToolbar
                outletId={selectedOutletId}
                onOutletChange={setSelectedOutletId}
                kind={kind}
                onKindChange={(nextKind) => {
                  setKind(nextKind);
                  setCreateOpen(false);
                  setDetailOpen(false);
                }}
                from={from}
                to={to}
                onRangeChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
                search={search}
                onSearchChange={setSearch}
                onExport={() => {
                  exportTransfersXlsx({ rows, filename });
                  toast.success(t("operations.inventory.transfer.exported", "Transfers exported."));
                }}
                onCreate={() => {
                  if (createDisabled || !createFromOutletId) return;
                  setCreateOpen(true);
                }}
                createDisabled={createDisabled || !createFromOutletId}
                createDisabledReason={createDisabledReason}
                status={status}
                onStatusChange={setStatus}
                workflowMode={transferMode}
              />
            </div>

            {!hasMultipleOutlets ? (
              <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700">
                {t(
                  "operations.inventory.transfer.oneOutletBanner",
                  "Transfer is unavailable because you don't have more than 1 outlet",
                )}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col p-4">
              <TransfersTable rows={rows} onRowClick={openDetail} />
              {query.error ? (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {query.error instanceof Error
                    ? query.error.message
                    : t("common.error", "Something went wrong.")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
      </StockManagementModuleShell>

      {orgId && canManage && hasMultipleOutlets && createFromOutletId ? (
        <CreateTransferDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={orgId}
          defaultFromOutletId={createFromOutletId}
          outlets={activeOutlets}
          kind={kind}
          workflowMode={transferMode}
        />
      ) : null}

      {orgId ? (
        <TransferDetailPanel
          open={detailOpen}
          onOpenChange={setDetailOpen}
          organizationId={orgId}
          transferId={selectedTransferId}
        />
      ) : null}
    </>
  );
}
