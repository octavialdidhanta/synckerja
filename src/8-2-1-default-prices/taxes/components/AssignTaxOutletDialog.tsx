import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignTaxOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignTaxOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignTaxOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.taxes.assignOutletTitle", "Assign Tax to Outlet")}
      confirmLabel={t("defaultPrices.taxes.assignTax", "Assign Tax")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
