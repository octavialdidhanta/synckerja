import { useTranslation } from "react-i18next";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { useInventorySyncLogsQuery } from "@/stock-management/hooks/useInventorySyncStatusQuery";
import { formatInventoryQty } from "@/stock-management/lib/formatInventoryQty";
import { INVENTORY_PLATFORMS } from "@/stock-management/types/inventory";
import { StockManagementDashboardSkeleton } from "@/6-0-stock-management/skeletons/StockManagementDashboardSkeleton";

function platformLabel(platform: string, t: (key: string, fallback: string) => string): string {
  const match = INVENTORY_PLATFORMS.find((p) => p.value === platform);
  return match ? t(match.labelKey, match.defaultLabel) : platform;
}

export default function StockSyncLogsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <StockManagementDashboardSkeleton />;
  return (
    <StockManagementModuleShell>
      <StockSyncLogsContent />
    </StockManagementModuleShell>
  );
}

function StockSyncLogsContent() {
  const { t } = useTranslation();
  const { organizationId, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data, isLoading } = useInventorySyncLogsQuery(organizationId);
  const rows = data?.rows ?? [];

  if (gatePending || (isLoading && rows.length === 0)) {
    return null;
  }

  return (
    <>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="min-h-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</TableHead>
                    <TableHead>{t("operations.stockManagement.colName", "Name")}</TableHead>
                    <TableHead>{t("operations.stockManagement.colProduct", "Product")}</TableHead>
                    <TableHead>{t("operations.stockManagement.colPlatform", "Platform")}</TableHead>
                    <TableHead className="min-w-[200px]">
                      {t("operations.stockManagement.colPlatformIds", "Product / SKU ID")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("operations.stockManagement.colAvailable", "Qty")}
                    </TableHead>
                    <TableHead>{t("operations.stockManagement.syncStatus", "Status")}</TableHead>
                    <TableHead>{t("operations.stockManagement.syncError", "Error")}</TableHead>
                    <TableHead>{t("operations.stockManagement.syncTime", "Time")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        {t("operations.stockManagement.noSyncLogs", "No sync logs yet.")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">
                          {row.internal_sku ?? row.sku_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate">{row.sku_name ?? "—"}</TableCell>
                        <TableCell className="max-w-[140px] truncate text-muted-foreground">
                          {row.product_name ?? "—"}
                        </TableCell>
                        <TableCell>{platformLabel(row.platform, t)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.platform_product_id && row.platform_sku_id
                            ? `${row.platform_product_id} / ${row.platform_sku_id}`
                            : row.platform_product_id || row.platform_sku_id || "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatInventoryQty(row.target_qty)}</TableCell>
                        <TableCell>
                          <Badge variant={row.success ? "default" : "destructive"}>
                            {row.success
                              ? t("operations.stockManagement.syncOk", "OK")
                              : t("operations.stockManagement.syncFailed", "Failed")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {row.error_message ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
            <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </>
  );
}
