import { useMemo, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { migrateLegacySkuToCatalogStock } from "@/stock-management/catalog-ledger/migrateLegacySkuToCatalogStock";
import { useOrphanInventorySkus } from "@/stock-management/hooks/useOrphanInventorySkus";
import { STOCK_MANAGEMENT_MAPPING_PATH } from "@/stock-management/lib/inventoryPaths";
import { InventorySummarySkeleton } from "../skeletons/InventorySummarySkeleton";
import { InventorySummaryToolbar } from "../components/InventorySummaryToolbar";
import { InventorySummaryTable } from "../components/InventorySummaryTable";
import { useInventorySummaryQuery } from "../hooks/useInventorySummaryQuery";
import { exportInventorySummaryXlsx } from "../lib/exportInventorySummaryXlsx";
import type { InventorySummaryKindFilter } from "../types";

export function InventorySummaryPage() {
  const queryClient = useQueryClient();
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { canManage } = useOmnichannelSurveySettingsAdmin();
  const { orphanCount } = useOrphanInventorySkus(organizationId);
  const { selectedOutletId, setSelectedOutletId, isLoading: outletLoading } = useSelectedPosOutlet(true, {
    allowAll: false,
  });
  const { t } = useAppTranslation();
  const [kind, setKind] = useState<InventorySummaryKindFilter>("item_library");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [to, setTo] = useState(() => endOfDay(new Date()));
  const [migrating, setMigrating] = useState(false);

  const query = useInventorySummaryQuery({
    organizationId,
    outletId: selectedOutletId,
    kind,
    periodStart: from,
    periodEnd: to,
    search,
  });
  const lines = query.data ?? [];
  const dataPending = orgBootstrapPending || outletLoading || query.isLoading;
  const showContent = useDebouncedReady(!dataPending, 180);
  const emptyLabel = useMemo(
    () => t("operations.inventory.summary.empty", "No tracked items for this outlet."),
    [t],
  );

  const handleMigrateSkuStock = async () => {
    if (!organizationId || migrating) return;
    setMigrating(true);
    try {
      const result = await migrateLegacySkuToCatalogStock(organizationId);
      toast.success(
        t("operations.inventory.summary.migrateSkuDone", "{{migrated}} product(s) migrated, {{skipped}} skipped.", {
          migrated: result.migrated,
          skipped: result.skipped,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
      await query.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setMigrating(false);
    }
  };

  if (!showContent) return <InventorySummarySkeleton />;

  return (
    <StockManagementModuleShell>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <InventorySummaryToolbar
              outletId={selectedOutletId}
              onOutletChange={setSelectedOutletId}
              from={from}
              to={to}
              onRangeChange={(nextFrom, nextTo) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
              kind={kind}
              onKindChange={setKind}
              search={search}
              onSearchChange={setSearch}
              onExport={() =>
                exportInventorySummaryXlsx({
                  lines,
                  filename: t("operations.inventory.summary.exportFile", "inventory-summary.xlsx"),
                })
              }
              canManage={canManage}
              migrating={migrating}
              onMigrateSkuStock={() => void handleMigrateSkuStock()}
            />
            {canManage && orphanCount > 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {t(
                  "operations.inventory.summary.orphanSkuBanner",
                  "{{count}} legacy SKU(s) (e.g. Susu UHT) are not in Item Library yet. Open Platform mapping → Create product, upload a photo, then save.",
                  { count: orphanCount },
                )}{" "}
                <Link to={STOCK_MANAGEMENT_MAPPING_PATH} className="font-medium underline underline-offset-2">
                  {t("operations.inventory.summary.orphanSkuBannerLink", "Go to Platform mapping")}
                </Link>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-x-auto">
            {query.error ? (
              <p className="p-6 text-sm text-destructive">
                {query.error instanceof Error ? query.error.message : emptyLabel}
              </p>
            ) : (
              <InventorySummaryTable lines={lines} />
            )}
          </div>
        </div>
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </StockManagementModuleShell>
  );
}
