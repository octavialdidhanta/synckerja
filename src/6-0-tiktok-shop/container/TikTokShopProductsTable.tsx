import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { TikTokShopProductRow } from "@/tiktok-shop/hooks/useTikTokShopProductsQuery";
import { formatTikTokShopMoney } from "@/tiktok-shop/lib/formatTikTokShopMoney";

type Props = {
  rows: TikTokShopProductRow[];
  isLoading?: boolean;
};

function primarySku(row: TikTokShopProductRow) {
  return row.skus[0] ?? null;
}

export function TikTokShopProductsTable({ rows, isLoading = false }: Props) {
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
        {t("digitalMarketing.tiktokShop.products.noProducts", "No products found.")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {t("digitalMarketing.tiktokShop.products.colProduct", "Product")}
            </TableHead>
            <TableHead>
              {t("digitalMarketing.tiktokShop.products.colStatus", "Status")}
            </TableHead>
            <TableHead>
              {t("digitalMarketing.tiktokShop.products.colSku", "SKU")}
            </TableHead>
            <TableHead className="text-right">
              {t("digitalMarketing.tiktokShop.products.colPrice", "Price")}
            </TableHead>
            <TableHead className="text-right">
              {t("digitalMarketing.tiktokShop.products.colStock", "Stock")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const sku = primarySku(row);
            return (
              <TableRow key={row.product_id}>
                <TableCell className="max-w-[240px] truncate font-medium">{row.title}</TableCell>
                <TableCell className="capitalize">{row.status.replace(/_/g, " ").toLowerCase()}</TableCell>
                <TableCell className="font-mono text-xs">
                  {sku?.seller_sku || sku?.sku_id || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {sku ? formatTikTokShopMoney(sku.price, sku.currency) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {sku?.stock != null ? sku.stock : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
