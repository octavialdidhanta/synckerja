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
import { useCatalogModifierGroups } from "../hooks/useCatalogModifierGroups";
import type { CatalogModifierGroup } from "../types";
import { ModifierGroupFormSheet } from "./ModifierGroupFormSheet";
import { AssignModifierToItemsSheet } from "./AssignModifierToItemsSheet";

export type LibraryModifiersManagerProps = {
  listClassName?: string;
};

export function LibraryModifiersManager({ listClassName }: LibraryModifiersManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = useCatalogModifierGroups();
  const { selectedOutletId, setSelectedOutletId } = useSelectedPosOutlet();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogModifierGroup | null>(null);
  const [assignGroup, setAssignGroup] = useState<CatalogModifierGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogModifierGroup | null>(null);
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

  const openEdit = (row: CatalogModifierGroup) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
    } catch {
      toast({
        title: t("defaultPrices.modifiers.deleteFailed", "Could not delete modifier."),
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
          {t("defaultPrices.nav.modifiers", "Modifiers")}
        </h2>
        <OutletFilterSelect
          value={selectedOutletId}
          onChange={setSelectedOutletId}
          className="h-10 w-[180px] shrink-0"
        />
        <div className="min-w-0 flex-1" aria-hidden />
        <Button type="button" className="shrink-0" onClick={openCreate}>
          {t("common.add", "Add")}
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
            <TableHead className="h-9">{t("defaultPrices.modifiers.columnGroup", "Modifier Group")}</TableHead>
            <TableHead className="h-9 w-[100px] text-right">
              {t("defaultPrices.modifiers.columnOptions", "Options")}
            </TableHead>
            <TableHead className="h-9 w-[140px] text-right">
              {t("defaultPrices.modifiers.columnItemStocks", "Item Stocks")}
            </TableHead>
            <TableHead className="h-9 w-[56px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                {t("defaultPrices.loading", "Loading...")}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                {t("defaultPrices.modifiers.empty", "No modifiers yet.")}
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                {t("defaultPrices.modifiers.emptyOutlet", "No modifiers assigned to this outlet.")}
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="py-2 font-medium">{row.name}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{row.options.length}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{row.product_ids.length}</TableCell>
                <TableCell className="py-1 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAssignGroup(row)}>
                        {t("defaultPrices.modifiers.assignToItem", "Assign To Item")}
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
      <ModifierGroupFormSheet
        group={editing}
        selectedOutletId={selectedOutletId}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
      />
      <AssignModifierToItemsSheet
        group={assignGroup}
        open={assignGroup != null}
        onOpenChange={(next) => {
          if (!next) setAssignGroup(null);
        }}
      />
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("defaultPrices.modifiers.deleteTitle", "Delete modifier?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.modifiers.deleteBody", "Delete {{name}}?", {
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
