import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
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
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useAdjustableProductsQuery } from "@/6-0-stock-management/adjustment/hooks/useAdjustableProductsQuery";
import { useAdjustableIngredientsQuery } from "@/6-0-stock-management/adjustment/hooks/useAdjustableIngredientsQuery";
import type { AdjustableProduct } from "@/6-0-stock-management/adjustment/hooks/useAdjustableProductsQuery";
import type { AdjustableIngredient } from "@/6-0-stock-management/adjustment/hooks/useAdjustableIngredientsQuery";
import { useSuppliersQuery } from "@/6-0-stock-management/suppliers/hooks/useSuppliersQuery";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { calcLineSubtotal, calcPoTotal, hasValidPoLines } from "../lib/poFormMath";
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from "../hooks/usePurchaseOrderMutations";
import type { PurchaseOrderKindFilter, PurchaseOrderLineDraft } from "../types";
import { PoAddItemPickerDialog } from "./PoAddItemPickerDialog";
import { PoEnterQtyDialog, type QtyRow } from "./PoEnterQtyDialog";

const NO_SUPPLIER = "__none__";

function lineKey(line: PurchaseOrderLineDraft): string {
  if (line.ingredientId) return `i:${line.ingredientId}`;
  if (line.variantId) return `v:${line.variantId}`;
  return `p:${line.productId}`;
}

export function CreatePurchaseOrderDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  defaultOutletId: string;
  kind: PurchaseOrderKindFilter;
  editPurchaseOrderId?: string | null;
  initialOutletId?: string;
  initialSupplierId?: string | null;
  initialNote?: string;
  initialLines?: PurchaseOrderLineDraft[];
}) {
  const { t } = useAppTranslation();
  const isProductMode = props.kind === "item_library";
  const isEdit = Boolean(props.editPurchaseOrderId);

  const [outletId, setOutletId] = useState(props.defaultOutletId);
  const [supplierId, setSupplierId] = useState<string>(NO_SUPPLIER);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseOrderLineDraft[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [qtyRows, setQtyRows] = useState<QtyRow[]>([]);
  const [qtyTitle, setQtyTitle] = useState("");

  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();

  const suppliersQuery = useSuppliersQuery({ organizationId: props.open ? props.organizationId : null });
  const productsQuery = useAdjustableProductsQuery({
    organizationId: props.open && isProductMode ? props.organizationId : null,
    outletId: props.open && isProductMode ? outletId : null,
  });
  const ingredientsQuery = useAdjustableIngredientsQuery({
    organizationId: props.open && !isProductMode ? props.organizationId : null,
    outletId: props.open && !isProductMode ? outletId : null,
  });

  useEffect(() => {
    if (!props.open) return;
    setOutletId(props.initialOutletId ?? props.defaultOutletId);
    setSupplierId(props.initialSupplierId ? props.initialSupplierId : NO_SUPPLIER);
    setNote(props.initialNote ?? "");
    setLines(props.initialLines ?? []);
  }, [props.open, props.initialOutletId, props.initialSupplierId, props.initialNote, props.initialLines, props.defaultOutletId]);

  const total = useMemo(() => calcPoTotal(lines), [lines]);
  const canSubmit = hasValidPoLines(lines) && Boolean(outletId);
  const busy = createMutation.isPending || updateMutation.isPending;

  const reset = () => {
    setNote("");
    setLines([]);
    setSupplierId(NO_SUPPLIER);
    setOutletId(props.defaultOutletId);
  };

  const handleProductSelect = (product: AdjustableProduct) => {
    if (product.variants.length > 0) {
      setQtyTitle(product.productName);
      setQtyRows(
        product.variants.map((variant) => ({
          key: variant.variantId,
          label: `${product.productName} · ${variant.variantName}`,
          inStock: variant.inStock,
          qty: 0,
          unitCost: 0,
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
          inStock: product.inStock,
          qty: 0,
          unitCost: 0,
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
        inStock: ingredient.inStock,
        qty: 0,
        unitCost: 0,
        ingredientId: ingredient.ingredientId,
      },
    ]);
    setQtyOpen(true);
  };

  const mergeLines = (incoming: PurchaseOrderLineDraft[]) => {
    setLines((prev) => {
      const map = new Map(prev.map((line) => [lineKey(line), line]));
      for (const line of incoming) {
        map.set(lineKey(line), line);
      }
      return Array.from(map.values());
    });
  };

  const submit = async (createAndFulfill: boolean) => {
    if (!canSubmit) return;
    try {
      if (isEdit && props.editPurchaseOrderId) {
        await updateMutation.mutateAsync({
          organizationId: props.organizationId,
          purchaseOrderId: props.editPurchaseOrderId,
          kind: props.kind,
          note,
          lines,
        });
        toast.success(t("operations.inventory.purchaseOrders.updated", "Purchase order updated."));
      } else {
        await createMutation.mutateAsync({
          organizationId: props.organizationId,
          outletId,
          supplierId: supplierId === NO_SUPPLIER ? null : supplierId,
          kind: props.kind,
          note,
          lines,
          createAndFulfill,
        });
        toast.success(
          createAndFulfill
            ? t("operations.inventory.purchaseOrders.createdAndFulfilled", "Purchase order created and fulfilled.")
            : t("operations.inventory.purchaseOrders.created", "Purchase order created."),
        );
      }
      reset();
      props.onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error", "Something went wrong."));
    }
  };

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
            <DialogTitle>
              {isEdit
                ? t("operations.inventory.purchaseOrders.editTitle", "Edit Purchase Order")
                : t("operations.inventory.purchaseOrders.createTitle", "Create Purchase Order")}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("operations.inventory.purchaseOrders.chooseOutlet", "Choose Outlet")}</Label>
              <OutletFilterSelect value={outletId} onChange={setOutletId} disabled={isEdit} />
            </div>
            <div className="space-y-1">
              <Label>{t("operations.inventory.purchaseOrders.chooseSupplier", "Choose Supplier")}</Label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SUPPLIER}>
                    {t("operations.inventory.purchaseOrders.noSupplier", "No Supplier (Default)")}
                  </SelectItem>
                  {(suppliersQuery.data ?? []).map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("operations.inventory.purchaseOrders.note", "Note")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("operations.inventory.purchaseOrders.notePlaceholder", "Write your note here...")}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              {t("operations.inventory.purchaseOrders.noteHint", "e.g. request note, tracking/shipping note")}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {t("operations.inventory.purchaseOrders.lineItems", "Purchase Order")}
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                {t("operations.inventory.purchaseOrders.addItem", "Add Item")}
              </Button>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("operations.inventory.purchaseOrders.colName", "Name")}</TableHead>
                    <TableHead className="text-right">{t("operations.inventory.purchaseOrders.qty", "Qty")}</TableHead>
                    <TableHead className="text-right">{t("operations.inventory.purchaseOrders.unitCost", "Unit Cost")}</TableHead>
                    <TableHead className="text-right">{t("operations.inventory.purchaseOrders.subtotal", "Subtotal")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {t("operations.inventory.purchaseOrders.noLines", "Add at least one item.")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line) => (
                      <TableRow key={lineKey(line)}>
                        <TableCell>{line.nameSnapshot}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatToRupiah(line.unitCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatToRupiah(calcLineSubtotal(line.qty, line.unitCost))}
                        </TableCell>
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
            <div className="flex justify-end text-sm font-semibold">
              {t("operations.inventory.purchaseOrders.total", "Total")}: {formatToRupiah(total)}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            {isEdit ? (
              <Button type="button" onClick={() => submit(false)} disabled={!canSubmit || busy}>
                {t("common.save", "Save")}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => submit(true)} disabled={!canSubmit || busy}>
                  {t("operations.inventory.purchaseOrders.createAndFulfill", "Create & Fulfill")}
                </Button>
                <Button type="button" onClick={() => submit(false)} disabled={!canSubmit || busy}>
                  {t("operations.inventory.purchaseOrders.createOnly", "Create")}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PoAddItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={isProductMode ? "product" : "ingredient"}
        products={productsQuery.data ?? []}
        ingredients={ingredientsQuery.data ?? []}
        onSelectProduct={handleProductSelect}
        onSelectIngredient={handleIngredientSelect}
      />

      <PoEnterQtyDialog
        open={qtyOpen}
        onOpenChange={setQtyOpen}
        title={t("operations.inventory.purchaseOrders.enterQtyTitle", "Enter Request Quantity — {{name}}", {
          name: qtyTitle,
        })}
        rows={qtyRows}
        onConfirm={mergeLines}
      />
    </>
  );
}
