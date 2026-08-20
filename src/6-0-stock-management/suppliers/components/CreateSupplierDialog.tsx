import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSaveSupplier } from "../hooks/useSaveSupplier";
import type { CatalogSupplier, SupplierFormValues } from "../types";

const emptyValues = (): SupplierFormValues => ({
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip: "",
});

export function CreateSupplierDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  supplier?: CatalogSupplier | null;
}) {
  const { t } = useAppTranslation();
  const saveMutation = useSaveSupplier();
  const [values, setValues] = useState<SupplierFormValues>(emptyValues());

  useEffect(() => {
    if (!props.open) return;
    if (props.supplier) {
      setValues({
        name: props.supplier.name,
        phone: props.supplier.phone ?? "",
        email: props.supplier.email ?? "",
        address: props.supplier.address ?? "",
        city: props.supplier.city ?? "",
        state: props.supplier.state ?? "",
        zip: props.supplier.zip ?? "",
      });
    } else {
      setValues(emptyValues());
    }
  }, [props.open, props.supplier]);

  const handleSave = async () => {
    if (!values.name.trim()) {
      toast.error(t("operations.inventory.suppliers.nameRequired", "Supplier name is required."));
      return;
    }
    try {
      await saveMutation.mutateAsync({
        organizationId: props.organizationId,
        supplierId: props.supplier?.id,
        values,
      });
      toast.success(
        props.supplier
          ? t("operations.inventory.suppliers.updated", "Supplier updated.")
          : t("operations.inventory.suppliers.created", "Supplier created."),
      );
      props.onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error", "Something went wrong."));
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.supplier
              ? t("operations.inventory.suppliers.editTitle", "Supplier Details")
              : t("operations.inventory.suppliers.createTitle", "Supplier Details")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("operations.inventory.suppliers.fieldName", "Name")}</Label>
            <Input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("operations.inventory.suppliers.fieldPhone", "Phone")}</Label>
              <Input
                value={values.phone}
                onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                placeholder="+62"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("operations.inventory.suppliers.fieldEmail", "Email")}</Label>
              <Input
                type="email"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("operations.inventory.suppliers.fieldAddress", "Address")}</Label>
            <Textarea
              value={values.address}
              onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("operations.inventory.suppliers.fieldCity", "City")}</Label>
              <Input value={values.city} onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("operations.inventory.suppliers.fieldState", "State")}</Label>
              <Input value={values.state} onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("operations.inventory.suppliers.fieldZip", "Zip")}</Label>
              <Input value={values.zip} onChange={(e) => setValues((v) => ({ ...v, zip: e.target.value }))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
            {t("common.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
