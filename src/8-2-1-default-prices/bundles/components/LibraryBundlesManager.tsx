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
import { Badge } from "@/shared/components/ui/badge";
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
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/lib/utils";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useCatalogBundles } from "../hooks/useCatalogBundles";
import type { CatalogBundle } from "../types";
import { BundleForm } from "./BundleForm";

export type LibraryBundlesManagerProps = {
  listClassName?: string;
};

export function LibraryBundlesManager({ listClassName }: LibraryBundlesManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = useCatalogBundles();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet(true, { allowAll: true });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogBundle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogBundle | null>(null);
  const filteredRows = useMemo(
    () =>
      !selectedOutletId || selectedOutletId === POS_OUTLET_FILTER_ALL
        ? rows
        : rows.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId)),
    [rows, selectedOutletId],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CatalogBundle) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
    } catch {
      toast({
        title: t("defaultPrices.bundles.deleteFailed", "Could not delete bundle."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (formOpen) {
    return (
      <BundleForm
        bundle={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OutletFilterSelect
          includeAll
          value={selectedOutletId}
          onChange={setSelectedOutletId}
        />
        <Button type="button" onClick={openCreate}>
          {t("defaultPrices.bundles.createButton", "Create Bundle")}
        </Button>
      </div>
      <div className={cn("overflow-y-auto", listClassName ?? "max-h-56")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("defaultPrices.bundles.columnName", "Name")}</TableHead>
              <TableHead className="w-[140px]">{t("defaultPrices.bundles.columnPrice", "Price")}</TableHead>
              <TableHead className="w-[100px]">{t("defaultPrices.bundles.columnItems", "Items")}</TableHead>
              <TableHead className="w-[120px]">{t("defaultPrices.bundles.columnStatus", "Status")}</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.loading", "Loading...")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.bundles.empty", "No bundles yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.bundles.emptyOutlet", "No bundles assigned to this outlet.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.use_sales_type_prices
                      ? t("defaultPrices.bundles.multiplePrices", "Multiple")
                      : formatToRupiah(row.bundle_price)}
                  </TableCell>
                  <TableCell>{row.items.length}</TableCell>
                  <TableCell>
                    <Badge variant={row.is_active ? "default" : "secondary"}>
                      {row.is_active
                        ? t("defaultPrices.bundles.statusActive", "Active")
                        : t("defaultPrices.bundles.statusInactive", "Inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("defaultPrices.bundles.deleteTitle", "Delete bundle?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.bundles.deleteBody", "Delete {{name}}?", {
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
