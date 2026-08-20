import { format } from "date-fns";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { InventorySuppliersSkeleton } from "../skeletons/InventorySuppliersSkeleton";
import { SuppliersToolbar, useSuppliersSearchState } from "../components/SuppliersToolbar";
import { SuppliersTable } from "../components/SuppliersTable";
import { CreateSupplierDialog } from "../components/CreateSupplierDialog";
import { useSuppliersQuery } from "../hooks/useSuppliersQuery";
import { exportSuppliersXlsx } from "../lib/exportSuppliersXlsx";
import type { CatalogSupplier } from "../types";

export function InventorySuppliersPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId: orgId } = useOrgBootstrapPending();
  const { gatePending } = useOmnichannelSurveySettingsAdmin();
  const { search, setSearch } = useSuppliersSearchState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogSupplier | null>(null);

  const query = useSuppliersQuery({ organizationId: orgId, search });
  const dataPending = orgBootstrapPending || gatePending || query.isLoading;
  const showContent = useDebouncedReady(!dataPending, 180);
  const rows = query.data ?? [];

  const filename = useMemo(
    () => `suppliers-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    [],
  );

  if (!showContent) return <InventorySuppliersSkeleton />;

  return (
    <>
      <StockManagementModuleShell>
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
          <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <SuppliersToolbar
                search={search}
                onSearchChange={setSearch}
                onCreate={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                onExport={() => {
                  exportSuppliersXlsx({ rows, filename });
                  toast.success(t("operations.inventory.suppliers.exported", "Suppliers exported."));
                }}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <SuppliersTable
                rows={rows}
                onRowClick={(row) => {
                  setEditing(row);
                  setDialogOpen(true);
                }}
              />
              {query.error ? (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {query.error instanceof Error ? query.error.message : t("common.error", "Something went wrong.")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </StockManagementModuleShell>

      {orgId ? (
        <CreateSupplierDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          organizationId={orgId}
          supplier={editing}
        />
      ) : null}
    </>
  );
}
