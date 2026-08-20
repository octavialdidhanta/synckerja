import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignBrandOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignBrandOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignBrandOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.brands.assignOutletTitle", "Assign Brand to Outlet")}
      confirmLabel={t("defaultPrices.brands.assignBrand", "Assign Brand")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
