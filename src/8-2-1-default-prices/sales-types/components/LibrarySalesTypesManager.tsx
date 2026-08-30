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
import { isDefaultCatalogSalesTypeName } from "../lib/defaultCatalogSalesTypes";
import { cn } from "@/shared/lib/utils";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { useCatalogSalesTypes } from "../hooks/useCatalogSalesTypes";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { salesTypeMissingGratuity } from "../lib/salesTypeGratuityWarnings";
import type { CatalogSalesType } from "../types";
import { SalesTypeFormSheet } from "./SalesTypeFormSheet";

export type LibrarySalesTypesManagerProps = {
  listClassName?: string;
};

export function LibrarySalesTypesManager({ listClassName }: LibrarySalesTypesManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = useCatalogSalesTypes();
  const { settings: checkoutSettings } = useCatalogCheckoutSettings();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogSalesType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogSalesType | null>(null);
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

  const openEdit = (row: CatalogSalesType) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (isDefaultCatalogSalesTypeName(deleteTarget.name)) {
      toast({
        title: t(
          "defaultPrices.salesType.deleteProtected",
          "Default sales types cannot be deleted.",
        ),
        variant: "destructive",
      });
      setDeleteTarget(null);
      return;
    }
    try {
      await remove(deleteTarget.id);
    } catch {
      toast({
        title: t("defaultPrices.salesType.deleteFailed", "Could not delete sales type."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const gratuityCountLabel = (count: number) => {
    if (count <= 1) {
      return t("defaultPrices.salesType.gratuityCountOne", "{{count}} gratuity", { count });
    }
    return t("defaultPrices.salesType.gratuityCountOther", "{{count}} gratuities", { count });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-lg font-semibold text-gray-900">
          {t("defaultPrices.salesType.newHeading", "New sales type")}
        </Label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <OutletFilterSelect value={selectedOutletId} onChange={setSelectedOutletId} />
          <Button type="button" onClick={openCreate}>
            {t("common.add", "Add")}
          </Button>
        </div>
      </div>
      <div className={cn("overflow-y-auto", listClassName ?? "max-h-56")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("defaultPrices.salesType.columnName", "Name")}</TableHead>
              <TableHead>{t("defaultPrices.salesType.columnGratuityApplied", "Gratuity Applied")}</TableHead>
              <TableHead className="w-[120px]">{t("defaultPrices.salesType.columnStatus", "Status")}</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.loading", "Loading...")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.salesType.empty", "No sales types yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.salesType.emptyOutlet", "No sales types assigned to this outlet.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="space-y-1">
                      <span>{gratuityCountLabel((row.gratuity_ids ?? []).length)}</span>
                      {salesTypeMissingGratuity(
                        row,
                        Boolean(checkoutSettings?.gratuity_enabled),
                      ) ? (
                        <p className="text-xs text-amber-700">
                          {t(
                            "defaultPrices.salesType.noGratuityWarning",
                            "No gratuity assigned — checkout will not collect service charge.",
                          )}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.is_active ? (
                      <span className="text-sm font-medium text-emerald-600">
                        {t("defaultPrices.salesType.statusActive", "Active")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("defaultPrices.salesType.statusInactive", "Inactive")}
                      </span>
                    )}
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
                        {!isDefaultCatalogSalesTypeName(row.name) ? (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("common.delete", "Delete")}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <SalesTypeFormSheet
        salesType={editing}
        selectedOutletId={selectedOutletId}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
      />
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("defaultPrices.salesType.deleteTitle", "Delete sales type?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.salesType.deleteBody", "Delete {{name}}?", {
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
