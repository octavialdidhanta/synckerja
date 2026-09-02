import type { ReactNode } from "react";
import { IngredientPanelFooter } from "./IngredientPanelFooter";
import { INGREDIENT_MAIN_GRID, INGREDIENT_TABLE_SECTION } from "./ingredientLayout";

type Props = {
  children: ReactNode;
  count?: number;
};

export function IngredientWorkspace({ children, count }: Props) {
  return (
    <div className={INGREDIENT_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
        <div className={INGREDIENT_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
            <IngredientPanelFooter count={count} />
          </div>
        </div>
      </div>
    </div>
  );
}
