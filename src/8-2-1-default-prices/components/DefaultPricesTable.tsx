import { useState } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { MoreVertical, Pencil, Trash2, ListChecks } from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
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
import type { DefaultPriceRow } from "../types/defaultPrices";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "decimal", minimumFractionDigits: 0 }).format(n);
}

export type DefaultPricesTableProps = {
  rows: DefaultPriceRow[];
  isLoading: boolean;
  onEdit: (row: DefaultPriceRow) => void;
  onDelete: (id: string) => Promise<void>;
  onOpenSop?: (row: DefaultPriceRow) => void;
};

export function DefaultPricesTable({ rows, isLoading, onEdit, onDelete, onOpenSop }: DefaultPricesTableProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DefaultPriceRow | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget.id);
      toast({ title: "Deleted", description: "Default price removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No default prices yet. Add one to auto-fill amount on lead conversion.
      </div>
    );
  }

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="max-w-[160px] w-[160px]">Service</TableHead>
            <TableHead className="min-w-[180px] w-[180px]">Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Unit Price (Rp)</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[160px] truncate" title={row.service_name ?? undefined}>
                {row.service_name ?? "-"}
              </TableCell>
              <TableCell className="min-w-[180px] max-w-[200px] truncate" title={row.sub_service_name ?? undefined}>
                {row.sub_service_name ?? "-"}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block cursor-default truncate">
                      {row.description?.trim() ? row.description : "-"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-sm rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {row.description?.trim() ? row.description : "—"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right font-medium">{formatRupiah(row.unit_price)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    {onOpenSop ? (
                      <DropdownMenuItem onClick={() => onOpenSop(row)}>
                        <ListChecks className="mr-2 h-4 w-4" />
                        Workflow / SOP
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => onEdit(row)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setDeleteTarget(row);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </TooltipProvider>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete default price</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this default price? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
