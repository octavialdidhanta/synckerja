import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogModifierGroups } from "@/8-2-1-default-prices/modifiers";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_CASHIER_I18N } from "../../../../lib/posCashierCopy";

type Props = {
  pendingGroupIds: string[];
  onOpenPicker: () => void;
  disabled?: boolean;
};

/** Thin POS block: list pending modifier sets + open picker/create flow. */
export function PosCreateItemModifiersBlock({
  pendingGroupIds,
  onOpenPicker,
  disabled,
}: Props) {
  const { t } = useAppTranslation();
  const { rows } = useCatalogModifierGroups();

  const names = pendingGroupIds.map((id) => {
    const row = rows.find((r) => r.id === id);
    return { id, name: row?.name ?? id.slice(0, 8) };
  });

  return (
    <div>
      <p className={POS_PANEL.sectionTitle}>
        {t(POS_CASHIER_I18N.setupModifier, "Modifier")}
      </p>
      <div className={POS_PANEL.card}>
        {names.length > 0
          ? names.map((row) => (
              <div key={row.id} className={POS_PANEL.row}>
                <span className={POS_PANEL.rowLabel}>{row.name}</span>
              </div>
            ))
          : null}
        <div className="px-3 py-3">
          <Button
            type="button"
            className="h-11 w-full text-sm font-semibold"
            disabled={disabled}
            onClick={onOpenPicker}
          >
            {t(POS_CASHIER_I18N.setupAddModifierSet, "Add Modifier Set")}
          </Button>
        </div>
      </div>
    </div>
  );
}
