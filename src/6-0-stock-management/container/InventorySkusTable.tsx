import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatInventoryQty } from "@/stock-management/lib/formatInventoryQty";
import type { InventorySkuRow } from "@/stock-management/types/inventory";

type Props = {
  rows: InventorySkuRow[];
  isLoading?: boolean;
  canManage?: boolean;
  onRestock?: (sku: InventorySkuRow) => void;
  onAdjust?: (sku: InventorySkuRow) => void;
  onOfflineSale?: (sku: InventorySkuRow) => void;
  onSync?: (sku: InventorySkuRow) => void;
};

export function InventorySkusTable({
  rows,
  isLoading = false,
  canManage = false,
  onRestock,
  onAdjust,
  onOfflineSale,
  onSync,
}: Props) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
        {t("operations.stockManagement.noSkus", "No SKUs yet. Create one or import CSV.")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</TableHead>
            <TableHead>{t("operations.stockManagement.colName", "Name")}</TableHead>
            <TableHead>{t("operations.stockManagement.colProduct", "Product")}</TableHead>
            <TableHead className="text-right">
              {t("operations.stockManagement.colAvailable", "Available")}
            </TableHead>
            <TableHead className="text-right">
              {t("operations.stockManagement.colUnit", "Unit")}
            </TableHead>
            {canManage ? (
              <TableHead className="text-right">
                {t("operations.stockManagement.colActions", "Actions")}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.internal_sku}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell className="max-w-[180px] truncate text-muted-foreground">
                {row.product_name}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatInventoryQty(row.available_qty)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{row.unit}</TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => onRestock?.(row)}>
                      {t("operations.stockManagement.restock", "Restock")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onAdjust?.(row)}>
                      {t("operations.stockManagement.adjust", "Adjust")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onOfflineSale?.(row)}>
                      {t("operations.stockManagement.offlineSale", "Offline sale")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onSync?.(row)} aria-label="Sync">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
