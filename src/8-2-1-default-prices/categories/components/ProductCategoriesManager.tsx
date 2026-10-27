import { useMemo, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";
import { cn } from "@/shared/lib/utils";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { useCatalogProductCategories } from "../hooks/useCatalogProductCategories";
import { useDefaultPrices } from "../../hooks/useDefaultPrices";
import type { CatalogProductCategory } from "../types";
import { AssignCategoryToItemsDialog } from "./AssignCategoryToItemsDialog";
import { CategoryFormSheet } from "./CategoryFormSheet";

export type ProductCategoriesManagerProps = {
  onSelect?: (category: CatalogProductCategory) => void;
  listClassName?: string;
  enableAssignToItem?: boolean;
};

export function ProductCategoriesManager({
  onSelect,
  listClassName,
  enableAssignToItem = true,
}: ProductCategoriesManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const categories = useCatalogProductCategories();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet();
  const { rows: catalogRows } = useDefaultPrices();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogProductCategory | null>(null);
  const [assignCategory, setAssignCategory] = useState<CatalogProductCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProductCategory | null>(null);

  const itemStocksByCategoryId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of catalogRows) {
      if (row.kind !== "product" || !row.product_category_id) continue;
      counts.set(row.product_category_id, (counts.get(row.product_category_id) ?? 0) + 1);
    }
    return counts;
  }, [catalogRows]);

  const filteredRows = useMemo(
    () =>
      selectedOutletId
        ? categories.rows.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId))
        : categories.rows,
    [categories.rows, selectedOutletId],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CatalogProductCategory) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await categories.remove(deleteTarget.id);
      if (editing?.id === deleteTarget.id) {
        setEditing(null);
        setFormOpen(false);
      }
    } catch {
      toast({
        title: t("defaultPrices.product.categoryDeleteFailed", "Could not delete category."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <h2 className="shrink-0 whitespace-nowrap text-lg font-semibold text-gray-900">
          {t("defaultPrices.nav.categories", "Categories")}
        </h2>
        <OutletFilterSelect
          value={selectedOutletId}
          onChange={setSelectedOutletId}
          className="h-10 w-[180px] shrink-0"
        />
        <div className="min-w-0 flex-1" aria-hidden />
        <Button type="button" className="shrink-0" onClick={openCreate}>
          {t("defaultPrices.category.createCategory", "Create Category")}
        </Button>
      </div>
      <Table
        containerClassName={cn(
          "min-h-0 flex-1 overflow-auto rounded-md border border-border/60 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          listClassName,
        )}
      >
        <TableHeader className="sticky top-0 z-[1] bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
          <TableRow>
            <TableHead className="h-9">{t("defaultPrices.category.columnName", "Category Name")}</TableHead>
            <TableHead className="h-9 w-[140px] text-right">
              {t("defaultPrices.category.columnItemStocks", "Item Stocks")}
            </TableHead>
            <TableHead className="h-9 w-[56px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                {t("defaultPrices.loading", "Loading...")}
              </TableCell>
            </TableRow>
          ) : categories.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                {t("defaultPrices.product.noCategories", "No categories yet.")}
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                {t("defaultPrices.category.emptyOutlet", "No categories assigned to this outlet.")}
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="py-2">
                  <button
                    type="button"
                    className="min-w-0 max-w-full truncate text-left text-sm"
                    onClick={() => onSelect?.(row)}
                  >
                    {row.name}
                  </button>
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums">
                  {itemStocksByCategoryId.get(row.id) ?? 0}
                </TableCell>
                <TableCell className="py-1 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {enableAssignToItem ? (
                        <DropdownMenuItem onClick={() => setAssignCategory(row)}>
                          {t("defaultPrices.category.assignToItem", "Assign To Item")}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => openEdit(row)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("common.edit", "Edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("common.delete", "Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <CategoryFormSheet
        category={editing}
        selectedOutletId={selectedOutletId}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
        onCreated={onSelect}
      />
      {enableAssignToItem ? (
        <AssignCategoryToItemsDialog
          category={assignCategory}
          open={assignCategory != null}
          onOpenChange={(next) => {
            if (!next) setAssignCategory(null);
          }}
        />
      ) : null}
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("defaultPrices.category.deleteTitle", "Delete category?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.category.deleteBody", "Delete {{name}}?", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
