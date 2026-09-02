import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { INGREDIENT_CATEGORIES_PATH, INGREDIENT_RECIPES_PATH } from "./IngredientHeaderAndTab";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith(INGREDIENT_RECIPES_PATH)) {
    return { key: "ingredient.tab.recipes", fallback: "Recipes" };
  }
  if (pathname.startsWith(INGREDIENT_CATEGORIES_PATH)) {
    return { key: "ingredient.tab.categories", fallback: "Categories" };
  }
  return { key: "ingredient.tab.library", fallback: "Library" };
}

export function IngredientPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("ingredient.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("ingredient.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
