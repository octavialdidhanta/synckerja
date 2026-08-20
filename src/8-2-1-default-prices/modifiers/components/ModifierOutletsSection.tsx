import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { summarizeAssignedOutlets } from "@/8-2-2-outlets/lib/assignedOutlets";
import { AssignModifierOutletDialog } from "./AssignModifierOutletDialog";

export type ModifierOutletsSectionProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ModifierOutletsSection({ selectedIds, onChange }: ModifierOutletsSectionProps) {
  const { t } = useAppTranslation();
  const { rows } = usePosOutlets();
  const [open, setOpen] = useState(false);
  const summary = summarizeAssignedOutlets(rows, selectedIds);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">
        {t("defaultPrices.modifiers.outletsSection", "Assigned Outlets")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t(
          "defaultPrices.modifiers.outletsHint",
          "Select outlets that sell this modifier",
        )}
      </p>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        {t("defaultPrices.modifiers.assignOutlet", "Assign Outlet")}
      </Button>
      {summary.names.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {summary.names.join(", ")}
          {summary.extra > 0 ? ` +${summary.extra}` : ""}
        </p>
      ) : (
        <p className="text-sm text-destructive">
          {t("outlets.assign.minOne", "Please select minimum one outlet")}
        </p>
      )}
      <AssignModifierOutletDialog
        open={open}
        onOpenChange={setOpen}
        selectedIds={selectedIds}
        onConfirm={onChange}
      />
    </section>
  );
}
