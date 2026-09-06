import { useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
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
        <button type="button" className="inline-flex text-slate-400 hover:text-slate-700">
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
    <section>
      <p className={POS_PANEL.sectionTitle}>
        <span className="inline-flex items-center gap-1.5">
          {t("defaultPrices.modifiers.stockSection", "Modifier stock")}
          <InfoTip
            text={t(
              "defaultPrices.modifiers.stockTooltip",
              "If activated, each selected option deducts the linked ingredient quantity on POS pay.",
            )}
          />
        </span>
      </p>

      <div className={POS_PANEL.card}>
        <div className={POS_PANEL.row}>
          <span className={POS_PANEL.rowLabel}>
            {t("defaultPrices.modifiers.stockSection", "Modifier stock")}
          </span>
          <Switch checked={stockEnabled} onCheckedChange={onStockEnabledChange} />
        </div>

        {stockEnabled ? (
          <>
            <div className={cn(POS_PANEL.row, "items-start")}>
              <p className="text-xs leading-relaxed text-slate-500">
                {t(
                  "defaultPrices.modifiers.stockIngredientsHint",
                  "Each modifier purchase will deduct the ingredient usage as much as the specified quantity.",
                )}
              </p>
            </div>
            {namedRows.length === 0 ? (
              <div className={cn(POS_PANEL.row, "items-start")}>
                <p className="text-xs text-amber-700">
                  {t(
                    "defaultPrices.modifiers.stockNeedOptions",
                    "Add option names above before linking ingredients.",
                  )}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid min-w-[22rem] grid-cols-[minmax(4.5rem,0.9fr)_minmax(7rem,1.4fr)_4.5rem_4.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <span>{t("defaultPrices.modifiers.stockColOption", "Option Name")}</span>
                  <span>{t("defaultPrices.modifiers.stockColIngredient", "Ingredient")}</span>
                  <span>{t("defaultPrices.modifiers.stockColQty", "Quantity")}</span>
                  <span>{t("defaultPrices.modifiers.stockColUnit", "Unit")}</span>
                </div>
                <div className="px-3">
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
          </>
        ) : null}
      </div>

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
