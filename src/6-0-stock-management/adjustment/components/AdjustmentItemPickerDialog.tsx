import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { AdjustableProduct } from "../hooks/useAdjustableProductsQuery";
import type { AdjustableIngredient } from "../hooks/useAdjustableIngredientsQuery";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function AdjustmentItemPickerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "product" | "ingredient";
  products: AdjustableProduct[];
  ingredients: AdjustableIngredient[];
  existingProductIds: Set<string>;
  existingIngredientIds: Set<string>;
  onAddProduct: (product: AdjustableProduct) => void;
  onAddIngredient: (ingredient: AdjustableIngredient) => void;
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
          <DialogTitle>{t("operations.inventory.adjustment.addItems", "Add Items")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("operations.inventory.adjustment.searchItems", "Search items")}
            className="pl-8"
          />
        </div>

        <div className="mt-4 min-h-[240px] max-h-[420px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("operations.inventory.adjustment.colItem", "Item")}</TableHead>
                {isProductMode ? (
                  <TableHead className="text-right">{t("operations.inventory.adjustment.colVariants", "Variants")}</TableHead>
                ) : null}
                <TableHead className="text-right">{t("operations.inventory.adjustment.colAction", "Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isProductMode ? 3 : 2} className="text-center text-sm text-muted-foreground">
                    {t("operations.inventory.adjustment.noItems", "No items found.")}
                  </TableCell>
                </TableRow>
              ) : (
                (filtered as Array<AdjustableProduct | AdjustableIngredient>).map((item) => {
                  if (isProductMode) {
                    const p = item as AdjustableProduct;
                    const alreadyAdded = props.existingProductIds.has(p.productId);
                    return (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {p.variants.length > 0 ? p.variants.length : 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            disabled={alreadyAdded}
                            className="rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => props.onAddProduct(p)}
                          >
                            {alreadyAdded ? t("common.added", "Added") : t("common.add", "Add")}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const i = item as AdjustableIngredient;
                  const alreadyAdded = props.existingIngredientIds.has(i.ingredientId);
                  return (
                    <TableRow key={i.ingredientId}>
                      <TableCell className="font-medium">{i.ingredientName}</TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          className="rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => props.onAddIngredient(i)}
                        >
                          {alreadyAdded ? t("common.added", "Added") : t("common.add", "Add")}
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

