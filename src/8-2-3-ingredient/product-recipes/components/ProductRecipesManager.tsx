import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import { buildProductRecipeListRows } from "../lib/productRecipeListRows";
import { useCatalogProductRecipes } from "../hooks/useCatalogProductRecipes";
import { ProductRecipeFormSheet } from "./ProductRecipeFormSheet";
import { ProductRecipeImportExportMenu } from "./ProductRecipeImportExportMenu";

export type ProductRecipesManagerProps = {
  selectedOutletId: string;
  onOutletChange: (id: string) => void;
};

export function ProductRecipesManager({ selectedOutletId, onOutletChange }: ProductRecipesManagerProps) {
  const { t } = useAppTranslation();
  const {
    rows: recipes,
    products,
    modifierLinks,
    modifierOptions,
    byKey,
    save,
    isSaving,
    isLoading,
  } = useCatalogProductRecipes();
  const { rows: ingredients } = useCatalogIngredients();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editProductId, setEditProductId] = useState("");
  const [editModifierOptionId, setEditModifierOptionId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");

  const listRows = useMemo(
    () =>
      buildProductRecipeListRows({
        recipes,
        products,
        modifierOptions,
        ingredients,
        outletId: selectedOutletId,
      }),
    [recipes, products, modifierOptions, ingredients, selectedOutletId],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listRows;
    return listRows.filter(
      (row) =>
        row.productName.toLowerCase().includes(q) ||
        row.variantLabel.toLowerCase().includes(q),
    );
  }, [listRows, search]);

  const openCreate = () => {
    setEditProductId("");
    setEditModifierOptionId(null);
    setSelectedRecipeId("");
    setSheetOpen(true);
  };

  const openEdit = (row: (typeof listRows)[number]) => {
    setEditProductId(row.productId);
    setEditModifierOptionId(row.modifierOptionId);
    setSelectedRecipeId(row.recipeId);
    setSheetOpen(true);
  };

  const stockAlertLabel = (alert: "out" | "low" | "") => {
    if (alert === "out") return t("ingredient.library.statusOut", "Out of Stock");
    if (alert === "low") return t("ingredient.library.statusLow", "Low Stock");
    return "";
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("ingredient.productRecipe.heading", "Recipes")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ProductRecipeImportExportMenu />
          <Button type="button" disabled={!selectedOutletId} onClick={openCreate}>
            {t("ingredient.productRecipe.createButton", "Create Recipe")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("ingredient.productRecipe.total", "Total : {{count}}", { count: filteredRows.length })}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <OutletFilterSelect value={selectedOutletId} onChange={onOutletChange} />
        <div className="relative min-w-[160px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ingredient.library.search", "Search")}
            className="h-9 pr-9"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ingredient.productRecipe.columnItem", "Item name")}</TableHead>
              <TableHead>{t("ingredient.productRecipe.columnVariant", "Variant")}</TableHead>
              <TableHead>{t("ingredient.productRecipe.columnIngredientCount", "Ingredient")}</TableHead>
              <TableHead>{t("ingredient.productRecipe.columnStockAlert", "Ingredient Stock Alert")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.page.loadingAria", "Loading ingredients")}
                </TableCell>
              </TableRow>
            ) : !selectedOutletId ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.library.outletRequired", "Select an outlet first.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.productRecipe.emptyList", "No Data To Display")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow
                  key={row.recipeId}
                  className={cn("cursor-pointer", selectedRecipeId === row.recipeId && "bg-muted/50")}
                  onClick={() => openEdit(row)}
                >
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell>{row.variantLabel || "—"}</TableCell>
                  <TableCell>
                    {t("ingredient.productRecipe.ingredientCount", "{{count}} ingredients", {
                      count: row.lineCount,
                    })}
                  </TableCell>
                  <TableCell>{stockAlertLabel(row.stockAlert)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductRecipeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedOutletId={selectedOutletId}
        products={products}
        modifierLinks={modifierLinks}
        modifierOptions={modifierOptions}
        recipesByKey={byKey}
        initialProductId={editProductId}
        initialModifierOptionId={editModifierOptionId}
        onSave={save}
        isSaving={isSaving}
      />
    </div>
  );
}
