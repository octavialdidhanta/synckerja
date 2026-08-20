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
import { Label } from "@/shared/components/ui/label";
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
    <div className="space-y-3">
      <div>
        <Label className="text-lg font-semibold text-gray-900">
          {t("defaultPrices.product.newCategory", "New category")}
        </Label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <OutletFilterSelect value={selectedOutletId} onChange={setSelectedOutletId} />
          <Button type="button" onClick={openCreate}>
            {t("defaultPrices.category.createCategory", "Create Category")}
          </Button>
        </div>
      </div>
      <div className={cn("overflow-y-auto", listClassName ?? "max-h-56")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("defaultPrices.category.columnName", "Category Name")}</TableHead>
              <TableHead className="w-[140px] text-right">
                {t("defaultPrices.category.columnItemStocks", "Item Stocks")}
              </TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.loading", "Loading...")}
                </TableCell>
              </TableRow>
            ) : categories.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.product.noCategories", "No categories yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.category.emptyOutlet", "No categories assigned to this outlet.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="min-w-0 max-w-full truncate text-left text-sm"
                      onClick={() => onSelect?.(row)}
                    >
                      {row.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {itemStocksByCategoryId.get(row.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
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
      </div>
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
