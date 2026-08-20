import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { AdjustableProduct } from "@/6-0-stock-management/adjustment/hooks/useAdjustableProductsQuery";
import type { AdjustableIngredient } from "@/6-0-stock-management/adjustment/hooks/useAdjustableIngredientsQuery";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function PoAddItemPickerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "product" | "ingredient";
  products: AdjustableProduct[];
  ingredients: AdjustableIngredient[];
  onSelectProduct: (product: AdjustableProduct) => void;
  onSelectIngredient: (ingredient: AdjustableIngredient) => void;
}) {
  const { t } = useAppTranslation();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.mode === "product" ? props.products : props.ingredients;
    if (props.mode === "product") return props.products.filter((p) => p.productName.toLowerCase().includes(q));
    return props.ingredients.filter((i) => i.ingredientName.toLowerCase().includes(q));
  }, [props.mode, props.products, props.ingredients, search]);

  const isProductMode = props.mode === "product";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("operations.inventory.purchaseOrders.addItem", "Add Item")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("operations.inventory.purchaseOrders.searchItems", "Search items")}
            className="pl-8"
          />
        </div>

        <div className="mt-4 max-h-[420px] min-h-[240px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("operations.inventory.purchaseOrders.colName", "Name")}</TableHead>
                <TableHead className="text-right">{t("common.action", "Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                    {t("operations.inventory.purchaseOrders.noItems", "No items found.")}
                  </TableCell>
                </TableRow>
              ) : isProductMode ? (
                (filtered as AdjustableProduct[]).map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell>{product.productName}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          props.onSelectProduct(product);
                          props.onOpenChange(false);
                        }}
                      >
                        {t("common.select", "Select")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                (filtered as AdjustableIngredient[]).map((ingredient) => (
                  <TableRow key={ingredient.ingredientId}>
                    <TableCell>{ingredient.ingredientName}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          props.onSelectIngredient(ingredient);
                          props.onOpenChange(false);
                        }}
                      >
                        {t("common.select", "Select")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
