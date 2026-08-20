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
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/lib/utils";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useCatalogDiscounts } from "../hooks/useCatalogDiscounts";
import type { CatalogDiscount } from "../types";
import { DiscountFormSheet } from "./DiscountFormSheet";

export type LibraryDiscountsManagerProps = {
  listClassName?: string;
};

function formatPercentAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}%`;
}

export function LibraryDiscountsManager({ listClassName }: LibraryDiscountsManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = useCatalogDiscounts();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet(true, { allowAll: true });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogDiscount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogDiscount | null>(null);
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

  const openEdit = (row: CatalogDiscount) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
    } catch {
      toast({
        title: t("defaultPrices.discounts.deleteFailed", "Could not delete discount."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatAmount = (row: CatalogDiscount): string => {
    if (row.input_configuration === "customizable" || row.amount_value == null) return "—";
    if (row.amount_unit === "percent") return formatPercentAmount(row.amount_value);
    return formatToRupiah(row.amount_value);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OutletFilterSelect
          includeAll
          value={selectedOutletId}
          onChange={setSelectedOutletId}
        />
        <Button type="button" onClick={openCreate}>
          {t("defaultPrices.discounts.createButton", "Create Discount")}
        </Button>
      </div>
      <div className={cn("overflow-y-auto", listClassName ?? "max-h-56")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("defaultPrices.discounts.columnName", "Name")}</TableHead>
              <TableHead className="w-[160px]">
                {t("defaultPrices.discounts.columnConfiguration", "Configuration")}
              </TableHead>
              <TableHead className="w-[140px] text-right">
                {t("defaultPrices.discounts.columnAmount", "Amount")}
              </TableHead>
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
                  {t("defaultPrices.discounts.empty", "No discounts yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.discounts.emptyOutlet", "No discounts assigned to this outlet.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.input_configuration === "customizable"
                      ? t("defaultPrices.discounts.configCustomizable", "Customizable amount")
                      : t("defaultPrices.discounts.configFixed", "Fixed amount")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatAmount(row)}</TableCell>
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
      <DiscountFormSheet
        discount={editing}
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
              {t("defaultPrices.discounts.deleteTitle", "Delete discount?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.discounts.deleteBody", "Delete {{name}}?", {
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
