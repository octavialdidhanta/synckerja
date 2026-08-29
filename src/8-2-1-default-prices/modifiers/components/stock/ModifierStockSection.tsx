import { useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogIngredients } from "@/8-2-3-ingredient/library/hooks/useCatalogIngredients";
import { ChooseModifierIngredientDialog } from "./ChooseModifierIngredientDialog";
import { ModifierStockOptionRow } from "./ModifierStockOptionRow";

export type ModifierStockRowState = {
  key: string;
  optionName: string;
  ingredientId: string | null;
  quantityDisplay: string;
};

export type ModifierStockSectionProps = {
  stockEnabled: boolean;
  onStockEnabledChange: (next: boolean) => void;
  rows: ModifierStockRowState[];
  onRowChange: (key: string, patch: Partial<Pick<ModifierStockRowState, "ingredientId" | "quantityDisplay">>) => void;
};

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-0 bg-gray-800 text-white">{text}</TooltipContent>
    </Tooltip>
  );
}

export function ModifierStockSection({
  stockEnabled,
  onStockEnabledChange,
  rows,
  onRowChange,
}: ModifierStockSectionProps) {
  const { t } = useAppTranslation();
  const { rows: ingredients } = useCatalogIngredients();
  const [pickForKey, setPickForKey] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map(ingredients.map((row) => [row.id, row]));
    return map;
  }, [ingredients]);

  const namedRows = rows.filter((row) => row.optionName.trim().length > 0);

  return (
    <section className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("defaultPrices.modifiers.stockSection", "Modifier stock")}
          </p>
          <InfoTip
            text={t(
              "defaultPrices.modifiers.stockTooltip",
              "If activated, each selected option deducts the linked ingredient quantity on POS pay.",
            )}
          />
        </div>
        <Switch checked={stockEnabled} onCheckedChange={onStockEnabledChange} />
      </div>

      {stockEnabled ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t(
              "defaultPrices.modifiers.stockIngredientsHint",
              "Each modifier purchase will deduct the ingredient usage as much as the specified quantity.",
            )}
          </p>
          {namedRows.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-500">
              {t(
                "defaultPrices.modifiers.stockNeedOptions",
                "Add option names above before linking ingredients.",
              )}
            </p>
          ) : (
            <div className="rounded-md border">
              <div className="grid grid-cols-[minmax(4.5rem,0.9fr)_minmax(7rem,1.4fr)_4.5rem_4.5rem] gap-2 border-b bg-muted/40 px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>{t("defaultPrices.modifiers.stockColOption", "Option Name")}</span>
                <span>{t("defaultPrices.modifiers.stockColIngredient", "Ingredient")}</span>
                <span>{t("defaultPrices.modifiers.stockColQty", "Quantity")}</span>
                <span>{t("defaultPrices.modifiers.stockColUnit", "Unit")}</span>
              </div>
              <div className="px-2">
                {namedRows.map((row) => {
                  const ing = row.ingredientId ? byId.get(row.ingredientId) : undefined;
                  return (
                    <ModifierStockOptionRow
                      key={row.key}
                      optionName={row.optionName}
                      ingredientId={row.ingredientId}
                      ingredientName={ing?.name ?? null}
                      unitCode={ing?.unit_code ?? null}
                      quantityDisplay={row.quantityDisplay}
                      onQuantityChange={(value) =>
                        onRowChange(row.key, { quantityDisplay: value })
                      }
                      onChooseIngredient={() => setPickForKey(row.key)}
                      onClearIngredient={() =>
                        onRowChange(row.key, { ingredientId: null, quantityDisplay: "" })
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <ChooseModifierIngredientDialog
        open={pickForKey != null}
        onOpenChange={(next) => {
          if (!next) setPickForKey(null);
        }}
        ingredients={ingredients}
        onAdd={(ingredientId) => {
          if (!pickForKey) return;
          onRowChange(pickForKey, {
            ingredientId,
            quantityDisplay: rows.find((r) => r.key === pickForKey)?.quantityDisplay || "1",
          });
          setPickForKey(null);
        }}
      />
    </section>
  );
}
