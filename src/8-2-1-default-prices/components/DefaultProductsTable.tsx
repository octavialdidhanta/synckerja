import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useOutletRecipeAvailability } from "@/stock-management/recipe-availability";
import type { DefaultPriceRow } from "../types/defaultPrices";
import { effectiveUnitPrice, effectivePosStatus } from "../product-outlets/lib/effectiveProductOutlet";
import { displaySku, outletQtyForTable } from "../product-variants";
import { useProductIdsWithBaseRecipe } from "../products";
import {
  displayPosStatusForTable,
  recipeStockBadge,
} from "../lib/displayRecipePosStatus";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "decimal", minimumFractionDigits: 0 }).format(n);
}

export type DefaultProductsTableProps = {
  rows: DefaultPriceRow[];
  isLoading: boolean;
  selectedOutletId?: string | null;
  onEdit: (row: DefaultPriceRow) => void;
  onDuplicate: (row: DefaultPriceRow) => void;
  onDelete: (id: string) => Promise<void>;
};

export function DefaultProductsTable({
  rows,
  isLoading,
  selectedOutletId,
  onEdit,
  onDuplicate,
  onDelete,
}: DefaultProductsTableProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DefaultPriceRow | null>(null);
  const { data: recipeProductIds } = useProductIdsWithBaseRecipe(rows.map((row) => row.id));
  const hasBaseRecipe = recipeProductIds ?? new Set<string>();
  const { byProduct: recipeByProduct } = useOutletRecipeAvailability(selectedOutletId);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget.id);
      toast({ title: t("defaultPrices.deleted", "Deleted") });
    } catch {
      toast({ title: t("defaultPrices.deleteFailed", "Failed to delete."), variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">{t("defaultPrices.loading", "Loading...")}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {selectedOutletId
          ? t("defaultPrices.product.emptyOutlet", "No products assigned to this outlet.")
          : t("defaultPrices.product.empty", "No products yet. Add a retail or F&B item with a photo.")}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[72px]">{t("defaultPrices.product.photo", "Photo")}</TableHead>
            <TableHead>{t("defaultPrices.product.name", "Name")}</TableHead>
            <TableHead>{t("defaultPrices.product.category", "Category")}</TableHead>
            <TableHead>{t("defaultPrices.product.brand", "Brand")}</TableHead>
            <TableHead className="w-[80px]">{t("defaultPrices.product.unit", "Unit")}</TableHead>
            <TableHead className="text-right">{t("defaultPrices.form.unitPrice", "Unit Price (Rp)")}</TableHead>
            <TableHead>{t("defaultPrices.product.posStatus", "POS")}</TableHead>
            <TableHead>{t("defaultPrices.product.stockMode", "Stock")}</TableHead>
            <TableHead>{t("defaultPrices.product.sku", "SKU")}</TableHead>
            <TableHead className="text-right">{t("defaultPrices.product.qty", "Qty")}</TableHead>
            <TableHead className="w-[80px]">{t("defaultPrices.actions", "Actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const price = effectiveUnitPrice(row, selectedOutletId ?? null);
            const recipeAvail = recipeByProduct.get(row.id);
            const isRecipe = hasBaseRecipe.has(row.id);
            const status = displayPosStatusForTable(
              row,
              selectedOutletId ?? null,
              recipeAvail,
              isRecipe,
            );
            const recipeDrivenOos =
              status === "sold_out" &&
              !row.track_stock &&
              isRecipe &&
              recipeAvail?.maxServings != null &&
              recipeAvail.maxServings <= 0 &&
              effectivePosStatus(row, selectedOutletId ?? null) === "available";
            const qty = outletQtyForTable({
              trackStock: Boolean(row.track_stock),
              outletId: selectedOutletId ?? null,
              variants: row.variants ?? [],
              productStock: selectedOutletId ? row.outlet_stocks?.[selectedOutletId] : undefined,
              variantStocks: row.variant_outlet_stocks,
            });
            const skuLabel = displaySku({
              catalogSku: row.catalog_sku,
              variants: row.variants ?? [],
              inventorySkuCode: row.sku_code,
            });
            const badge = recipeStockBadge(recipeAvail, isRecipe, Boolean(row.track_stock));
            const recipeQty =
              !row.track_stock && isRecipe && recipeAvail?.maxServings != null
                ? recipeAvail.maxServings
                : null;
            const limiting = recipeAvail?.limiting;
            const qtyTitle =
              limiting && recipeQty != null
                ? t(
                    "defaultPrices.product.limitedByIngredient",
                    "Limited by {{name}} ({{available}}/{{needed}})",
                    {
                      name: limiting.ingredientName,
                      available: String(limiting.available),
                      needed: String(limiting.needed),
                    },
                  )
                : undefined;

            return (
            <TableRow key={row.id}>
              <TableCell>
                {row.photo_url ? (
                  <img src={row.photo_url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-[180px] truncate font-medium">{row.name || row.service_name || "—"}</TableCell>
              <TableCell className="max-w-[140px] truncate text-xs">
                {row.product_category_name || t("defaultPrices.product.uncategorized", "Uncategorized")}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-xs">
                {row.product_brand_name || t("defaultPrices.product.unbranded", "Unbranded")}
              </TableCell>
              <TableCell>{row.unit || "pcs"}</TableCell>
              <TableCell className="text-right font-medium">{formatRupiah(price)}</TableCell>
              <TableCell className="text-xs">
                {recipeDrivenOos
                  ? t("defaultPrices.product.status.recipe_out_of_stock", "Out of stock")
                  : t(`defaultPrices.product.status.${status}`, status)}
              </TableCell>
              <TableCell className="text-xs">
                <span className="inline-flex flex-wrap items-center gap-1">
                  {row.track_stock
                    ? t("defaultPrices.product.tracked", "Tracked")
                    : isRecipe
                      ? t("defaultPrices.product.menuRecipe", "Menu (recipe)")
                      : t("defaultPrices.product.untracked", "Menu (no stock)")}
                  {badge === "out" ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                      {t("defaultPrices.product.recipeStockOut", "Out")}
                    </span>
                  ) : null}
                  {badge === "low" ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      {t("defaultPrices.product.recipeStockLow", "Low")}
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="text-xs">{skuLabel}</TableCell>
              <TableCell className="text-right tabular-nums" title={qtyTitle}>
                {row.track_stock
                  ? (qty ?? 0)
                  : recipeQty != null
                    ? recipeQty
                    : "—"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(row)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t("common.edit", "Edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(row)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t("common.duplicate", "Duplicate")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("common.delete", "Delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("defaultPrices.confirmDeleteTitle", "Delete product?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.confirmDeleteBody", "This cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
