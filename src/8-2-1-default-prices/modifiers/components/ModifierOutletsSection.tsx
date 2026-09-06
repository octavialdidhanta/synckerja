import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
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
    <section>
      <p className={POS_PANEL.sectionTitle}>
        {t("defaultPrices.modifiers.outletsSection", "Assigned Outlets")}
      </p>
      <div className={cn(POS_PANEL.card, "mb-1")}>
        <div className={cn(POS_PANEL.row, "flex-col items-stretch gap-2")}>
          <p className="text-xs leading-relaxed text-slate-500">
            {t(
              "defaultPrices.modifiers.outletsHint",
              "Select outlets that sell this modifier",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-slate-200 bg-white text-sm font-semibold text-slate-800"
            onClick={() => setOpen(true)}
          >
            {t("defaultPrices.modifiers.assignOutlet", "Assign Outlet")}
          </Button>
          {summary.names.length > 0 ? (
            <p className="text-sm text-slate-700">
              {summary.names.join(", ")}
              {summary.extra > 0 ? ` +${summary.extra}` : ""}
            </p>
          ) : (
            <p className="text-sm text-destructive">
              {t("outlets.assign.minOne", "Please select minimum one outlet")}
            </p>
          )}
        </div>
      </div>
      <AssignModifierOutletDialog
        open={open}
        onOpenChange={setOpen}
        selectedIds={selectedIds}
        onConfirm={onChange}
      />
    </section>
  );
}
