import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignModifierOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignModifierOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignModifierOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.modifiers.assignOutletTitle", "Assign Modifier to Outlet")}
      confirmLabel={t("defaultPrices.modifiers.assignModifier", "Assign Modifier")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
