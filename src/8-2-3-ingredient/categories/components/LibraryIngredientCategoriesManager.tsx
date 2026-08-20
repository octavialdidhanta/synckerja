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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import { useCatalogIngredientCategories } from "../hooks/useCatalogIngredientCategories";
import { ingredientCountByCategoryForOutlet } from "../lib/ingredientCategoryMembership";
import type { CatalogIngredientCategory } from "../types";
import { AssignCategoryToIngredientsDialog } from "./AssignCategoryToIngredientsDialog";
import { IngredientCategoryFormSheet } from "./IngredientCategoryFormSheet";

export type LibraryIngredientCategoriesManagerProps = {
  selectedOutletId: string;
  onOutletChange: (id: string) => void;
  listClassName?: string;
};

export function LibraryIngredientCategoriesManager({
  selectedOutletId,
  onOutletChange,
  listClassName,
}: LibraryIngredientCategoriesManagerProps) {
  const { t } = useAppTranslation();
  const categories = useCatalogIngredientCategories();
  const ingredients = useCatalogIngredients();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogIngredientCategory | null>(null);
  const [assignCategory, setAssignCategory] = useState<CatalogIngredientCategory | null>(null);
  const [search, setSearch] = useState("");

  const stockCounts = useMemo(
    () => ingredientCountByCategoryForOutlet(ingredients.rows, selectedOutletId),
    [ingredients.rows, selectedOutletId],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.rows.filter((row) => {
      if (selectedOutletId && !(row.outlet_ids ?? []).includes(selectedOutletId)) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categories.rows, search, selectedOutletId]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CatalogIngredientCategory) => {
    setEditing(row);
    setFormOpen(true);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("ingredient.categories.heading", "Ingredient Categories")}
        </h2>
        <Button type="button" onClick={openCreate} disabled={!selectedOutletId}>
          {t("ingredient.categories.createButton", "Create Ingredient Category")}
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <OutletFilterSelect value={selectedOutletId} onChange={onOutletChange} />
        <div className="relative min-w-[160px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("ingredient.categories.search", "Search")}
            className="h-9 pr-9"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", listClassName)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t("ingredient.categories.columnName", "Ingredient Category Name")}
              </TableHead>
              <TableHead>{t("ingredient.categories.columnStocks", "Ingredient Stocks")}</TableHead>
              <TableHead className="w-[200px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.page.loadingAria", "Loading ingredients")}
                </TableCell>
              </TableRow>
            ) : categories.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.empty.categories", "No ingredient categories yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t(
                    "ingredient.categories.emptyOutlet",
                    "No categories assigned to this outlet.",
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(row)}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {t("ingredient.categories.stockCount", "{{count}} ingredients", {
                      count: stockCounts.get(row.id) ?? 0,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setAssignCategory(row);
                      }}
                    >
                      {t("ingredient.categories.assignButton", "Assign to Ingredient")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <IngredientCategoryFormSheet
        category={editing}
        selectedOutletId={selectedOutletId}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
      />
      <AssignCategoryToIngredientsDialog
        category={assignCategory}
        selectedOutletId={selectedOutletId}
        open={assignCategory != null}
        onOpenChange={(next) => {
          if (!next) setAssignCategory(null);
        }}
      />
    </div>
  );
}
