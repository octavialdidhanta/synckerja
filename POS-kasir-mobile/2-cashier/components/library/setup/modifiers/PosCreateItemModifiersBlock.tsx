import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogModifierGroups } from "@/8-2-1-default-prices/modifiers";
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
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {t(POS_CASHIER_I18N.setupModifier, "Modifier")}
      </p>
      {names.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          {names.map((row) => (
            <li key={row.id} className="truncate text-sm font-medium text-slate-800">
              {row.name}
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        className="h-11 w-full"
        disabled={disabled}
        onClick={onOpenPicker}
      >
        {t(POS_CASHIER_I18N.setupAddModifierSet, "Add Modifier Set")}
      </Button>
    </div>
  );
}
