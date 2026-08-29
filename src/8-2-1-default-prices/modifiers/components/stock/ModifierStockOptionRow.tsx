import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatIngredientUnitCode } from "@/8-2-3-ingredient/library/lib/ingredientUnits";
import { ModifierStockClearButton } from "./ChooseModifierIngredientDialog";

export type ModifierStockOptionRowProps = {
  optionName: string;
  ingredientId: string | null;
  ingredientName: string | null;
  unitCode: string | null;
  quantityDisplay: string;
  onQuantityChange: (value: string) => void;
  onChooseIngredient: () => void;
  onClearIngredient: () => void;
};

export function ModifierStockOptionRow({
  optionName,
  ingredientId,
  ingredientName,
  unitCode,
  quantityDisplay,
  onQuantityChange,
  onChooseIngredient,
  onClearIngredient,
}: ModifierStockOptionRowProps) {
  const { t } = useAppTranslation();

  return (
    <div className="grid grid-cols-[minmax(4.5rem,0.9fr)_minmax(7rem,1.4fr)_4.5rem_4.5rem] items-center gap-2 border-b py-2 last:border-b-0">
      <span className="truncate text-sm text-muted-foreground" title={optionName}>
        {optionName || "—"}
      </span>
      <div className="min-w-0">
        {ingredientId && ingredientName ? (
          <div className="flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm" title={ingredientName}>
              {ingredientName}
            </span>
            <ModifierStockClearButton
              onClear={onClearIngredient}
              label={t("defaultPrices.modifiers.stockClearIngredient", "Clear ingredient")}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-start px-2 text-sm font-normal text-muted-foreground"
            onClick={onChooseIngredient}
          >
            {t("defaultPrices.modifiers.stockChooseIngredient", "Choose Ingredient")}
          </Button>
        )}
      </div>
      <Input
        inputMode="decimal"
        value={quantityDisplay}
        onChange={(e) => onQuantityChange(e.target.value.replace(/[^\d.,]/g, ""))}
        placeholder={t("defaultPrices.modifiers.stockQtyPlaceholder", "Qty")}
        className="h-9"
        disabled={!ingredientId}
      />
      <span className="truncate text-xs text-muted-foreground" title={unitCode ?? undefined}>
        {unitCode ? formatIngredientUnitCode(unitCode) : "—"}
      </span>
    </div>
  );
}
