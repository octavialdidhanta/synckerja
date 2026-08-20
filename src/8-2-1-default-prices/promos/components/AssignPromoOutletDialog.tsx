import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignPromoOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignPromoOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignPromoOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.promos.assignOutletTitle", "Assign Promo to Outlet")}
      confirmLabel={t("defaultPrices.promos.assignPromo", "Assign Promo")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
