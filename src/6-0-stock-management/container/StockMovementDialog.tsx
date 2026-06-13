import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { InventorySkuRow } from "@/stock-management/types/inventory";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: InventorySkuRow | null;
  mode: "restock" | "adjust" | "offline_sale";
  onSubmit: (qty: number, note: string) => Promise<void>;
};

export function StockMovementDialog({ open, onOpenChange, sku, mode, onSubmit }: Props) {
  const { t } = useTranslation();
  const [qty, setQty] = useState("0");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQty(mode === "adjust" ? "0" : "1");
      setNote("");
    }
  }, [open, mode]);

  const title =
    mode === "restock"
      ? t("operations.stockManagement.restockTitle", "Restock")
      : mode === "adjust"
        ? t("operations.stockManagement.adjustTitle", "Adjust stock")
        : t("operations.stockManagement.offlineSaleTitle", "Offline sale");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(Math.floor(Number(qty) || 0), note.trim());
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {sku ? (
          <p className="text-sm text-muted-foreground">
            {sku.internal_sku} — {t("operations.stockManagement.currentQty", "Current")}: {sku.available_qty}
          </p>
        ) : null}
        <div className="space-y-3">
          <div>
            <Label>
              {mode === "adjust"
                ? t("operations.stockManagement.qtyDelta", "Qty change (+/-)")
                : t("operations.stockManagement.qty", "Quantity")}
            </Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>{t("operations.stockManagement.note", "Note")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button disabled={submitting || !sku} onClick={handleSubmit}>
            {t("common.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
