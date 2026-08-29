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
import { usePoWorkflowMode } from "@/6-0-stock-management/hooks/useCatalogInventoryWorkflowModes";
import { useInventoryFeatureAccessCheck } from "@/8-2-5-inventory-settings/hooks/useInventoryFeatureAccess";
import { InventoryPurchaseOrdersSkeleton } from "../skeletons/InventoryPurchaseOrdersSkeleton";
import { PurchaseOrdersToolbar } from "../components/PurchaseOrdersToolbar";
import { PurchaseOrdersTable } from "../components/PurchaseOrdersTable";
import { CreatePurchaseOrderDialog } from "../components/CreatePurchaseOrderDialog";
import { PurchaseOrderDetailPanel } from "../components/PurchaseOrderDetailPanel";
import { usePurchaseOrdersQuery } from "../hooks/usePurchaseOrdersQuery";
import { exportPurchaseOrdersXlsx } from "../lib/exportPurchaseOrdersXlsx";
import type {
  PurchaseOrderKindFilter,
  PurchaseOrderListRow,
  PurchaseOrderStatusFilter,
} from "../types";

export function InventoryPurchaseOrdersPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId: orgId } = useOrgBootstrapPending();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const {
    selectedOutletId,
    setSelectedOutletId,
    outlets,
    isLoading: outletLoading,
  } = useSelectedPosOutlet(true, { allowAll: true });

  const { poMode } = usePoWorkflowMode();
  const poRequestAccess = useInventoryFeatureAccessCheck(poMode === "advanced" ? "po_request" : null);

  const [kind, setKind] = useState<PurchaseOrderKindFilter>("item_library");
  const [status, setStatus] = useState<PurchaseOrderStatusFilter>("all");
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [to, setTo] = useState(() => endOfDay(new Date()));
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const query = usePurchaseOrdersQuery({
    organizationId: orgId,
    outletId: selectedOutletId,
    kind,
    status,
    from,
    to,
    search,
  });

  const dataPending = orgBootstrapPending || gatePending || outletLoading || query.isLoading;
  const showContent = useDebouncedReady(!dataPending, 180);
  const rows = query.data ?? [];

  const createOutletId = useMemo(() => {
    if (selectedOutletId && selectedOutletId !== POS_OUTLET_FILTER_ALL) return selectedOutletId;
    return outlets.find((o) => o.is_active)?.id ?? outlets[0]?.id ?? "";
  }, [selectedOutletId, outlets]);

  const poCreateBlockedByRole =
    poMode === "advanced" && (poRequestAccess.isLoading || poRequestAccess.data === false);
  const canCreatePo = canManage && Boolean(createOutletId) && !poCreateBlockedByRole;
  const createDisabledReason =
    poMode === "advanced" && poRequestAccess.data === false
      ? t(
          "operations.inventory.purchaseOrders.noFeatureAccess",
          "You do not have PO Request access. Ask an admin to assign it in Inventory Settings.",
        )
      : undefined;

  const filename = useMemo(() => `purchase-orders-${format(new Date(), "yyyy-MM-dd")}.xlsx`, []);

  const openDetail = (row: PurchaseOrderListRow) => {
    setSelectedPoId(row.id);
    setDetailOpen(true);
  };

  if (!showContent) return <InventoryPurchaseOrdersSkeleton />;

  return (
    <>
      <StockManagementModuleShell>
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
          <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <PurchaseOrdersToolbar
                outletId={selectedOutletId}
                onOutletChange={setSelectedOutletId}
                kind={kind}
                onKindChange={(nextKind) => {
                  setKind(nextKind);
                  setCreateOpen(false);
                  setDetailOpen(false);
                }}
                status={status}
                onStatusChange={setStatus}
                from={from}
                to={to}
                onRangeChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
                search={search}
                onSearchChange={setSearch}
                onExport={() => {
                  exportPurchaseOrdersXlsx({ rows, filename });
                  toast.success(
                    t("operations.inventory.purchaseOrders.exported", "Purchase orders exported."),
                  );
                }}
                onCreate={() => {
                  if (!canCreatePo) return;
                  setCreateOpen(true);
                }}
                createDisabled={!canCreatePo}
                createDisabledReason={createDisabledReason}
                workflowMode={poMode}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4">
              <PurchaseOrdersTable rows={rows} onRowClick={openDetail} />
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
      </StockManagementModuleShell>

      {orgId && canManage && createOutletId ? (
        <CreatePurchaseOrderDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={orgId}
          defaultOutletId={createOutletId}
          kind={kind}
          poMode={poMode}
        />
      ) : null}

      {orgId ? (
        <PurchaseOrderDetailPanel
          open={detailOpen}
          onOpenChange={setDetailOpen}
          organizationId={orgId}
          purchaseOrderId={selectedPoId}
          kind={kind}
        />
      ) : null}
    </>
  );
}
