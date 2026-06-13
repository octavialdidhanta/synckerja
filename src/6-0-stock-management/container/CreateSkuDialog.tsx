import { useState } from "react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    internal_sku: string;
    name: string;
    product_name: string;
    initial_qty: number;
    unit: string;
  }) => Promise<void>;
};

export function CreateSkuDialog({ open, onOpenChange, onSubmit }: Props) {
  const { t } = useTranslation();
  const [internalSku, setInternalSku] = useState("");
  const [name, setName] = useState("");
  const [productName, setProductName] = useState("");
  const [initialQty, setInitialQty] = useState("0");
  const [unit, setUnit] = useState("pcs");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        internal_sku: internalSku.trim(),
        name: name.trim() || internalSku.trim(),
        product_name: productName.trim() || name.trim() || internalSku.trim(),
        initial_qty: Math.max(0, Math.floor(Number(initialQty) || 0)),
        unit: unit.trim() || "pcs",
      });
      onOpenChange(false);
      setInternalSku("");
      setName("");
      setProductName("");
      setInitialQty("0");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("operations.stockManagement.createSkuTitle", "Add SKU")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</Label>
            <Input value={internalSku} onChange={(e) => setInternalSku(e.target.value)} />
          </div>
          <div>
            <Label>{t("operations.stockManagement.colName", "Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("operations.stockManagement.colProduct", "Product")}</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
          </div>
          <div>
            <Label>{t("operations.stockManagement.initialQty", "Initial qty")}</Label>
            <Input type="number" min={0} value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
          </div>
          <div>
            <Label>{t("operations.stockManagement.colUnit", "Unit")}</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button disabled={!internalSku.trim() || submitting} onClick={handleSubmit}>
            {t("common.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
