import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignDiscountOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignDiscountOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignDiscountOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.discounts.assignOutletTitle", "Assign Discount to Outlet")}
      confirmLabel={t("defaultPrices.discounts.assignDiscount", "Assign Discount")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
