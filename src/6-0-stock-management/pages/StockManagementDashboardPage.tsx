import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { InventorySkusTable } from "@/6-0-stock-management/container/InventorySkusTable";
import { CreateSkuDialog } from "@/6-0-stock-management/container/CreateSkuDialog";
import { StockMovementDialog } from "@/6-0-stock-management/container/StockMovementDialog";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Button } from "@/shared/components/ui/button";
import { useInventorySkusQuery } from "@/stock-management/hooks/useInventorySkusQuery";
import {
  adjustInventorySku,
  createInventorySku,
  importInventoryCsv,
  recordOfflineSale,
  restockInventorySku,
  triggerInventorySync,
  processInventorySyncQueue,
} from "@/stock-management/lib/inventoryApi";
import type { InventorySkuRow } from "@/stock-management/types/inventory";
import { StockManagementDashboardSkeleton } from "@/6-0-stock-management/skeletons/StockManagementDashboardSkeleton";
import { supabase } from "@/shared/lib/supabaseClient";

export default function StockManagementDashboardPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <StockManagementDashboardSkeleton />;
  return (
    <StockManagementModuleShell>
      <StockManagementDashboardContent />
    </StockManagementModuleShell>
  );
}

function StockManagementDashboardContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data, isLoading, isFetching } = useInventorySkusQuery(organizationId);
  const rows = data?.rows ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<"restock" | "adjust" | "offline_sale">("restock");
  const [selectedSku, setSelectedSku] = useState<InventorySkuRow | null>(null);

  const showSkeleton = gatePending || (isLoading && rows.length === 0);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["inventory-skus", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-movements", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-sync-logs", organizationId] });
  }, [queryClient, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`inventory-stock-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_stock_levels",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, invalidate]);

  const handleImportCsv = useCallback(async () => {
    if (!organizationId) return;
    const raw = window.prompt(
      t(
        "operations.stockManagement.csvPrompt",
        "Paste CSV rows: internal_sku,name,initial_qty (one per line)",
      ),
    );
    if (!raw?.trim()) return;
    const parsed = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [internal_sku, name, initial_qty] = line.split(",").map((p) => p.trim());
        return { internal_sku, name, initial_qty: Number(initial_qty) || 0 };
      });
    try {
      const result = await importInventoryCsv(organizationId, parsed);
      toast.success(
        t("operations.stockManagement.importDone", "Imported {{count}} SKU(s)", {
          count: result.created,
        }),
      );
      if (result.errors.length > 0) {
        toast.error(result.errors.slice(0, 3).join("; "));
      }
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, [organizationId, t, invalidate]);

  const movementHandler = useMemo(() => {
    if (!organizationId || !selectedSku) return async () => {};
    return async (qty: number, note: string) => {
      if (movementMode === "restock") {
        await restockInventorySku(organizationId, selectedSku.id, qty, note);
      } else if (movementMode === "adjust") {
        await adjustInventorySku(organizationId, selectedSku.id, qty, note);
      } else {
        await recordOfflineSale(organizationId, selectedSku.id, qty, note);
      }
      toast.success(t("operations.stockManagement.movementSaved", "Stock updated"));
      invalidate();
    };
  }, [organizationId, selectedSku, movementMode, t, invalidate]);

  if (showSkeleton) return null;

  return (
    <>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {t("operations.stockManagement.sharedPoolHint", "Shared pool — same qty on all mapped platforms")}
                    </p>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={handleImportCsv}>
                          <Upload className="mr-1 h-4 w-4" />
                          {t("operations.stockManagement.importCsv", "Import CSV")}
                        </Button>
                        <Button size="sm" onClick={() => setCreateOpen(true)}>
                          <Plus className="mr-1 h-4 w-4" />
                          {t("operations.stockManagement.addSku", "Add SKU")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <InventorySkusTable
                    rows={rows}
                    isLoading={isFetching && rows.length === 0}
                    canManage={canManage}
                    onRestock={(sku) => {
                      setSelectedSku(sku);
                      setMovementMode("restock");
                      setMovementOpen(true);
                    }}
                    onAdjust={(sku) => {
                      setSelectedSku(sku);
                      setMovementMode("adjust");
                      setMovementOpen(true);
                    }}
                    onOfflineSale={(sku) => {
                      setSelectedSku(sku);
                      setMovementMode("offline_sale");
                      setMovementOpen(true);
                    }}
                    onSync={async (sku) => {
                      if (!organizationId) return;
                      try {
                        await triggerInventorySync(organizationId, sku.id);
                        await processInventorySyncQueue(organizationId);
                        toast.success(t("operations.stockManagement.syncQueued", "Sync queued"));
                        invalidate();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : String(err));
                      }
                    }}
                  />
                </div>
              </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />

      <CreateSkuDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (payload) => {
          if (!organizationId) return;
          await createInventorySku(organizationId, payload);
          toast.success(t("operations.stockManagement.skuCreated", "SKU created"));
          invalidate();
        }}
      />
      <StockMovementDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        sku={selectedSku}
        mode={movementMode}
        onSubmit={movementHandler}
      />
    </>
  );
}
