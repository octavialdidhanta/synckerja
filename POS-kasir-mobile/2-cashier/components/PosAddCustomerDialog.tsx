import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";

export type PosCashierCustomer = {
  name: string;
  phone: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PosCashierCustomer | null;
  onSave: (customer: PosCashierCustomer) => void;
};

export function PosAddCustomerDialog({ open, onOpenChange, initial, onSave }: Props) {
  const { t } = useAppTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");

  const handleOpen = (next: boolean) => {
    if (next) {
      setName(initial?.name ?? "");
      setPhone(initial?.phone ?? "");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(POS_CASHIER_I18N.addCustomer, "+ Add Customer")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pos-customer-name">
              {t(POS_CASHIER_I18N.customerName, "Name")}
            </Label>
            <Input
              id="pos-customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-customer-phone">
              {t(POS_CASHIER_I18N.customerPhone, "Phone")}
            </Label>
            <Input
              id="pos-customer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t(POS_CASHIER_I18N.customerSkip, "Skip")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave({ name: name.trim() || "Walk-in", phone: phone.trim() });
              onOpenChange(false);
            }}
          >
            {t(POS_CASHIER_I18N.customerSave, "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
