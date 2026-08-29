import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useAdjustableProductsQuery } from "@/6-0-stock-management/adjustment/hooks/useAdjustableProductsQuery";
import { useAdjustableIngredientsQuery } from "@/6-0-stock-management/adjustment/hooks/useAdjustableIngredientsQuery";
import type { AdjustableProduct } from "@/6-0-stock-management/adjustment/hooks/useAdjustableProductsQuery";
import type { AdjustableIngredient } from "@/6-0-stock-management/adjustment/hooks/useAdjustableIngredientsQuery";
import type { PosOutlet } from "@/8-2-2-outlets/types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { lineKey, mapCatalogTransferRpcError } from "../lib/transferHelpers";
import { useCreateStockTransfer } from "../hooks/useCreateStockTransfer";
import type { TransferKindFilter, StockTransferLineDraft } from "../types";
import { TransferAddItemPickerDialog } from "./TransferAddItemPickerDialog";
import { TransferEnterQtyDialog, type TransferQtyRow } from "./TransferEnterQtyDialog";

function pickOtherOutletId(outlets: PosOutlet[], excludeId: string): string {
  const other = outlets.find((outlet) => outlet.id !== excludeId && outlet.is_active) ?? outlets.find((outlet) => outlet.id !== excludeId);
  return other?.id ?? "";
}

export function CreateTransferDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  defaultFromOutletId: string;
  outlets: PosOutlet[];
  kind: TransferKindFilter;
  workflowMode?: "simple" | "advanced";
}) {
  const { t } = useAppTranslation();
  const isProductMode = props.kind === "item_library";
  const createMutation = useCreateStockTransfer();

  const [fromOutletId, setFromOutletId] = useState(props.defaultFromOutletId);
  const [toOutletId, setToOutletId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockTransferLineDraft[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [qtyRows, setQtyRows] = useState<TransferQtyRow[]>([]);
  const [qtyTitle, setQtyTitle] = useState("");

  const productsQuery = useAdjustableProductsQuery({
    organizationId: props.open && isProductMode ? props.organizationId : null,
    outletId: props.open && isProductMode ? fromOutletId : null,
  });
  const ingredientsQuery = useAdjustableIngredientsQuery({
    organizationId: props.open && !isProductMode ? props.organizationId : null,
    outletId: props.open && !isProductMode ? fromOutletId : null,
  });

  const activeOutlets = useMemo(() => props.outlets.filter((outlet) => outlet.is_active), [props.outlets]);

  useEffect(() => {
    if (!props.open) return;
    const from = activeOutlets.some((outlet) => outlet.id === props.defaultFromOutletId)
      ? props.defaultFromOutletId
      : activeOutlets[0]?.id ?? "";
    setFromOutletId(from);
    setToOutletId(pickOtherOutletId(activeOutlets, from));
    setNote("");
    setLines([]);
  }, [props.open, props.defaultFromOutletId, activeOutlets]);

  const sameOutlet = Boolean(fromOutletId && toOutletId && fromOutletId === toOutletId);
  const canSubmit = lines.some((line) => line.qty > 0) && Boolean(fromOutletId && toOutletId) && !sameOutlet;
  const busy = createMutation.isPending;

  const changeFromOutlet = (id: string) => {
    setFromOutletId(id);
    setLines([]);
    if (id === toOutletId) setToOutletId(pickOtherOutletId(activeOutlets, id));
  };

  const changeToOutlet = (id: string) => {
    setToOutletId(id);
    if (id === fromOutletId) {
      const nextFrom = pickOtherOutletId(activeOutlets, id);
      if (nextFrom) {
        setFromOutletId(nextFrom);
        setLines([]);
      }
    }
  };

  const handleProductSelect = (product: AdjustableProduct) => {
    if (product.variants.length > 0) {
      setQtyTitle(product.productName);
      setQtyRows(
        product.variants.map((variant) => ({
          key: variant.variantId,
          label: `${product.productName} · ${variant.variantName}`,
          unit: product.unit,
          inStock: variant.inStock,
          qty: 0,
          productId: product.productId,
          variantId: variant.variantId,
        })),
      );
    } else {
      setQtyTitle(product.productName);
      setQtyRows([
        {
          key: product.productId,
          label: product.productName,
          unit: product.unit,
          inStock: product.inStock,
          qty: 0,
          productId: product.productId,
          variantId: null,
        },
      ]);
    }
    setQtyOpen(true);
  };

  const handleIngredientSelect = (ingredient: AdjustableIngredient) => {
    setQtyTitle(ingredient.ingredientName);
    setQtyRows([
      {
        key: ingredient.ingredientId,
        label: ingredient.ingredientName,
        unit: ingredient.unit,
        inStock: ingredient.inStock,
        qty: 0,
        ingredientId: ingredient.ingredientId,
      },
    ]);
    setQtyOpen(true);
  };

  const mergeLines = (incoming: StockTransferLineDraft[]) => {
    setLines((prev) => {
      const map = new Map(prev.map((line) => [lineKey(line), line]));
      for (const line of incoming) {
        map.set(lineKey(line), line);
      }
      return Array.from(map.values());
    });
  };

  const reset = () => {
    setNote("");
    setLines([]);
  };

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await createMutation.mutateAsync({
        organizationId: props.organizationId,
        fromOutletId,
        toOutletId,
        kind: props.kind,
        note,
        lines,
      });
      toast.success(t("operations.inventory.transfer.created", "Transfer created."));
      reset();
      props.onOpenChange(false);
    } catch (err) {
      toast.error(mapCatalogTransferRpcError(err, t("common.error", "Something went wrong.")));
    }
  };

  const outletOptions = activeOutlets;

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={(open) => {
          if (!open) reset();
          props.onOpenChange(open);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("operations.inventory.transfer.createTitle", "Create Transfer")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {props.workflowMode === "advanced"
                ? t(
                    "operations.inventory.transfer.createAdvancedHint",
                    "Advanced mode: transfer goes through request, approval, ship, and fulfill steps.",
                  )
                : t(
                    "operations.inventory.transfer.createSimpleHint",
                    "Simple mode: stock moves immediately between outlets.",
                  )}
            </p>
            {props.workflowMode === "advanced" ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  "operations.inventory.transfer.shipStockNote",
                  "Stock availability is checked when the transfer is shipped, not at request time.",
                )}
              </p>
            ) : null}
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("operations.inventory.transfer.from", "FROM")}</Label>
              <Select value={fromOutletId || undefined} onValueChange={changeFromOutlet}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={t("operations.inventory.transfer.chooseOutlet", "Choose outlet")} />
                </SelectTrigger>
                <SelectContent>
                  {outletOptions.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      <span className="truncate">{outlet.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("operations.inventory.transfer.to", "TO")}</Label>
              <Select value={toOutletId || undefined} onValueChange={changeToOutlet}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={t("operations.inventory.transfer.chooseOutlet", "Choose outlet")} />
                </SelectTrigger>
                <SelectContent>
                  {outletOptions.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      <span className="truncate">{outlet.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {sameOutlet ? (
            <p className="text-sm text-destructive">
              {t("operations.inventory.transfer.sameOutlet", "From and To outlets must be different.")}
            </p>
          ) : null}

          <div className="space-y-1">
            <Label>{t("operations.inventory.transfer.note", "NOTE")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("operations.inventory.transfer.notePlaceholder", "Write a note (optional)")}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {t("operations.inventory.transfer.lineItems", "Transfer items")}
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                {isProductMode
                  ? t("operations.inventory.transfer.addItems", "Add Items")
                  : t("operations.inventory.transfer.addIngredients", "Add Ingredients")}
              </Button>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("operations.inventory.transfer.colName", "Name")}</TableHead>
                    <TableHead>{t("operations.inventory.transfer.colUnit", "Unit")}</TableHead>
                    <TableHead className="text-right">{t("operations.inventory.transfer.inStock", "In Stock")}</TableHead>
                    <TableHead className="text-right">
                      {t("operations.inventory.transfer.transferQty", "Transfer Quantity")}
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {t("operations.inventory.transfer.noLines", "Add at least one item.")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => (
                      <TableRow key={lineKey(line)}>
                        <TableCell>{line.nameSnapshot}</TableCell>
                        <TableCell className="text-muted-foreground">{line.unitSnapshot?.trim() || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.inStock}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setLines((prev) => prev.filter((item) => lineKey(item) !== lineKey(line)))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit || busy}>
              {t("operations.inventory.transfer.create", "Create Transfer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferAddItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={isProductMode ? "product" : "ingredient"}
        products={productsQuery.data ?? []}
        ingredients={ingredientsQuery.data ?? []}
        onSelectProduct={handleProductSelect}
        onSelectIngredient={handleIngredientSelect}
      />

      <TransferEnterQtyDialog
        open={qtyOpen}
        onOpenChange={setQtyOpen}
        title={t("operations.inventory.transfer.enterQtyTitle", "Enter Transfer Quantity — {{name}}", {
          name: qtyTitle,
        })}
        rows={qtyRows}
        onConfirm={mergeLines}
      />
    </>
  );
}
