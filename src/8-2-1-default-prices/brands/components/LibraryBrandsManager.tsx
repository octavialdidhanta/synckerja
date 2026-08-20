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
import { useDefaultPrices } from "../../hooks/useDefaultPrices";
import { useCatalogBrands } from "../hooks/useCatalogBrands";
import type { CatalogBrand } from "../types";
import { BrandFormSheet } from "./BrandFormSheet";
import { AssignBrandToItemsSheet } from "./AssignBrandToItemsSheet";

export type LibraryBrandsManagerProps = {
  listClassName?: string;
};

export function LibraryBrandsManager({ listClassName }: LibraryBrandsManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = useCatalogBrands();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet();
  const { rows: catalogRows } = useDefaultPrices();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogBrand | null>(null);
  const [assignBrand, setAssignBrand] = useState<CatalogBrand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogBrand | null>(null);

  const itemStocksByBrandId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of catalogRows) {
      if (row.kind !== "product" || !row.product_brand_id) continue;
      counts.set(row.product_brand_id, (counts.get(row.product_brand_id) ?? 0) + 1);
    }
    return counts;
  }, [catalogRows]);

  const filteredRows = useMemo(
    () =>
      selectedOutletId
        ? rows.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId))
        : rows,
    [rows, selectedOutletId],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CatalogBrand) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
    } catch {
      toast({
        title: t("defaultPrices.brands.deleteFailed", "Could not delete brand."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OutletFilterSelect value={selectedOutletId} onChange={setSelectedOutletId} />
        <Button type="button" onClick={openCreate}>
          {t("defaultPrices.brands.createButton", "Create Brands")}
        </Button>
      </div>
      <div className={cn("overflow-y-auto", listClassName ?? "max-h-56")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("defaultPrices.brands.columnName", "Name")}</TableHead>
              <TableHead className="w-[140px] text-right">
                {t("defaultPrices.brands.columnItemStocks", "Item Stocks")}
              </TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.loading", "Loading...")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.brands.empty", "No brands yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.brands.emptyOutlet", "No brands assigned to this outlet.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {itemStocksByBrandId.get(row.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setAssignBrand(row)}>
                          {t("defaultPrices.brands.assignToItem", "Assign To Item")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("common.edit", "Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row)}>
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
      <BrandFormSheet
        brand={editing}
        selectedOutletId={selectedOutletId}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
      />
      <AssignBrandToItemsSheet
        brand={assignBrand}
        open={assignBrand != null}
        onOpenChange={(next) => {
          if (!next) setAssignBrand(null);
        }}
      />
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("defaultPrices.brands.deleteTitle", "Delete brand?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.brands.deleteBody", "Delete {{name}}?", {
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
