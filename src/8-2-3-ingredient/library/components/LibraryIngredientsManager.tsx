import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogIngredients } from "../hooks/useCatalogIngredients";
import { formatIngredientStockQty, ingredientStockStatus } from "../lib/ingredientStockStatus";
import { formatIngredientUnitCode } from "../lib/ingredientUnits";
import { stockForOutlet, type CatalogIngredient } from "../types";
import { useCatalogIngredientCategories } from "../../categories/hooks/useCatalogIngredientCategories";
import { categoryNameById } from "../../categories/lib/ingredientCategoryMembership";
import { CreateIngredientMenu } from "./CreateIngredientMenu";
import { IngredientFormSheet } from "./IngredientFormSheet";
import { IngredientImportExportMenu } from "./IngredientImportExportMenu";
import { SemiFinishedIngredientFormSheet } from "./SemiFinishedIngredientFormSheet";

export type LibraryIngredientsManagerProps = {
  selectedOutletId: string;
  onOutletChange: (id: string) => void;
  listClassName?: string;
};

const FILTER_ALL = "__all__";
const FILTER_UNCATEGORIZED = "__uncategorized__";

export function LibraryIngredientsManager({
  selectedOutletId,
  onOutletChange,
  listClassName,
}: LibraryIngredientsManagerProps) {
  const { t } = useAppTranslation();
  const { rows, isLoading } = useCatalogIngredients();
  const { rows: categoryRows } = useCatalogIngredientCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [semiOpen, setSemiOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogIngredient | null>(null);
  const [kindFilter, setKindFilter] = useState(FILTER_ALL);
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);
  const [inventoryFilter, setInventoryFilter] = useState(FILTER_ALL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setCategoryFilter(FILTER_ALL);
  }, [selectedOutletId]);

  const outletCategories = useMemo(
    () => categoryRows.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId)),
    [categoryRows, selectedOutletId],
  );

  const uncategorizedLabel = t("ingredient.library.uncategorized", "Uncategorized");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (selectedOutletId && !(row.outlet_ids ?? []).includes(selectedOutletId)) return false;
      if (kindFilter !== FILTER_ALL && row.kind !== kindFilter) return false;
      if (categoryFilter === FILTER_UNCATEGORIZED && row.category_id) return false;
      if (
        categoryFilter !== FILTER_ALL &&
        categoryFilter !== FILTER_UNCATEGORIZED &&
        row.category_id !== categoryFilter
      ) {
        return false;
      }
      if (q && !row.name.toLowerCase().includes(q)) return false;
      if (inventoryFilter !== FILTER_ALL) {
        const status = ingredientStockStatus(row, selectedOutletId);
        if (inventoryFilter === "low" && status !== "low") return false;
        if (inventoryFilter === "out" && status !== "out") return false;
      }
      return true;
    });
  }, [categoryFilter, inventoryFilter, kindFilter, rows, search, selectedOutletId]);

  const openCreateRaw = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openCreateSemi = () => {
    setEditing(null);
    setSemiOpen(true);
  };

  const openEdit = (row: CatalogIngredient) => {
    setEditing(row);
    if (row.kind === "semi_finished") {
      setSemiOpen(true);
      return;
    }
    setFormOpen(true);
  };

  const stockAlertLabel = (row: CatalogIngredient) => {
    const status = ingredientStockStatus(row, selectedOutletId);
    if (status === "low") return t("ingredient.library.statusLow", "Low Stock");
    if (status === "out") return t("ingredient.library.statusOut", "Out of Stock");
    return "";
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("ingredient.library.heading", "Ingredient Library")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <IngredientImportExportMenu />
          <CreateIngredientMenu
            disabled={!selectedOutletId}
            onCreateRaw={openCreateRaw}
            onCreateSemi={openCreateSemi}
          />
          <span className="text-sm text-muted-foreground">
            {t("ingredient.library.total", "Total : {{count}}", { count: filteredRows.length })}
          </span>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <OutletFilterSelect value={selectedOutletId} onChange={onOutletChange} />
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder={t("ingredient.library.filterType", "All Ingredient Types")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>{t("ingredient.library.filterType", "All Ingredient Types")}</SelectItem>
            <SelectItem value="raw">{t("ingredient.library.rawIngredient", "Raw Ingredient")}</SelectItem>
            <SelectItem value="semi_finished">{t("ingredient.library.semiFinished", "Semi-Finished Ingredient")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder={t("ingredient.library.allCategories", "All Categories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>
              {t("ingredient.library.allCategories", "All Categories")}
            </SelectItem>
            <SelectItem value={FILTER_UNCATEGORIZED}>{uncategorizedLabel}</SelectItem>
            {outletCategories.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={inventoryFilter} onValueChange={setInventoryFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>{t("ingredient.library.allInventory", "All Inventory")}</SelectItem>
            <SelectItem value="low">{t("ingredient.library.statusLow", "Low Stock")}</SelectItem>
            <SelectItem value="out">{t("ingredient.library.statusOut", "Out of Stock")}</SelectItem>
          </SelectContent>
        </Select>
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
      <div className={cn("min-h-0 flex-1 overflow-y-auto", listClassName)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ingredient.library.columnName", "Name")}</TableHead>
              <TableHead>{t("ingredient.library.columnCategory", "Category")}</TableHead>
              <TableHead>{t("ingredient.library.columnInStock", "In Stock")}</TableHead>
              <TableHead>{t("ingredient.library.columnUnit", "Unit")}</TableHead>
              <TableHead>{t("ingredient.library.columnAlert", "Stock Alert")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.page.loadingAria", "Loading ingredients")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.empty.library", "No ingredients yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("ingredient.library.emptyOutlet", "No ingredients assigned to this outlet.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const stock = stockForOutlet(row, selectedOutletId);
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(row)}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {categoryNameById(categoryRows, row.category_id, uncategorizedLabel)}
                    </TableCell>
                    <TableCell>{row.track_inventory ? formatIngredientStockQty(stock.in_stock) : ""}</TableCell>
                    <TableCell>{formatIngredientUnitCode(row.unit_code)}</TableCell>
                    <TableCell>{stockAlertLabel(row)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <IngredientFormSheet
        ingredient={editing?.kind === "semi_finished" ? null : editing}
        selectedOutletId={selectedOutletId}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
      />
      <SemiFinishedIngredientFormSheet
        ingredient={editing?.kind === "semi_finished" ? editing : null}
        selectedOutletId={selectedOutletId}
        open={semiOpen}
        onOpenChange={(next) => {
          setSemiOpen(next);
          if (!next) setEditing(null);
        }}
      />
    </div>
  );
}
