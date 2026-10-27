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
import { useCatalogPromos } from "../hooks/useCatalogPromos";
import { matchesPromoListFilters, promoListStatus } from "../lib/promoListStatus";
import type { CatalogPromo, PromoListStatus, PromoListStatusFilter } from "../types";
import { PromoListToolbar } from "./PromoListToolbar";
import { PromoWizard } from "./PromoWizard";

export type LibraryPromosManagerProps = {
  listClassName?: string;
};

export function LibraryPromosManager({ listClassName }: LibraryPromosManagerProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { rows, isLoading, remove } = useCatalogPromos();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogPromo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogPromo | null>(null);
  const [statusFilter, setStatusFilter] = useState<PromoListStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesPromoListFilters(row, { status: statusFilter, query: searchQuery })),
    [rows, statusFilter, searchQuery],
  );

  const openCreate = () => {
    setEditing(null);
    setWizardOpen(true);
  };

  const openEdit = (row: CatalogPromo) => {
    setEditing(row);
    setWizardOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
    } catch {
      toast({
        title: t("defaultPrices.promos.deleteFailed", "Could not delete promo."),
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const typeLabel = (row: CatalogPromo) =>
    row.promo_type === "free_item"
      ? t("defaultPrices.promos.typeFree", "Free Item")
      : t("defaultPrices.promos.typeDiscount", "Discount per Item");

  const periodLabel = (row: CatalogPromo) => {
    if (!row.time_period_enabled || !row.starts_on || !row.ends_on) {
      return t("defaultPrices.promos.periodAlways", "Always");
    }
    return `${row.starts_on} – ${row.ends_on}`;
  };

  const statusLabel = (status: PromoListStatus) => {
    if (status === "scheduled") return t("defaultPrices.promos.filter.scheduled", "Scheduled");
    if (status === "inactive") return t("defaultPrices.promos.filter.inactive", "Inactive");
    return t("defaultPrices.promos.filter.ongoing", "Ongoing");
  };

  if (wizardOpen) {
    return (
      <PromoWizard
        promo={editing}
        onClose={() => {
          setWizardOpen(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-3 flex min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <h2 className="shrink-0 whitespace-nowrap text-lg font-semibold text-gray-900">
          {t("defaultPrices.promos.heading", "Promo")}
        </h2>
        <PromoListToolbar
          status={statusFilter}
          onStatusChange={setStatusFilter}
          query={searchQuery}
          onQueryChange={setSearchQuery}
        />
        <div className="min-w-[8px] flex-1" aria-hidden />
        <Button type="button" className="shrink-0" onClick={openCreate}>
          {t("defaultPrices.promos.createButton", "Create Promo")}
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
              <TableHead className="h-9">{t("defaultPrices.promos.columnName", "Name")}</TableHead>
              <TableHead className="h-9 w-[180px]">{t("defaultPrices.promos.columnType", "Type")}</TableHead>
              <TableHead className="h-9 w-[180px]">{t("defaultPrices.promos.columnPeriod", "Period")}</TableHead>
              <TableHead className="h-9 w-[120px]">{t("defaultPrices.promos.columnStatus", "Status")}</TableHead>
              <TableHead className="h-9 w-[56px]" />
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
                  {t("defaultPrices.promos.empty", "No promos yet.")}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("defaultPrices.promos.emptyFilter", "No promos match this filter.")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{typeLabel(row)}</TableCell>
                  <TableCell>{periodLabel(row)}</TableCell>
                  <TableCell>{statusLabel(promoListStatus(row))}</TableCell>
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
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("defaultPrices.promos.deleteTitle", "Delete promo?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.promos.deleteBody", "Delete {{name}}?", {
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
