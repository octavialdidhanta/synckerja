import { BookOpen, Lock, Package, Tag } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export const INGREDIENT_INDEX_PATH = "/operations/ingredient";
export const INGREDIENT_LIST_PATH = "/operations/ingredient/list";
export const INGREDIENT_CATEGORIES_PATH = "/operations/ingredient/categories";
export const INGREDIENT_RECIPES_PATH = "/operations/ingredient/recipes";

export type IngredientSubTab = "library" | "categories" | "recipes";

export function ingredientTabFromPathname(pathname: string): IngredientSubTab {
  if (pathname.startsWith(INGREDIENT_RECIPES_PATH)) return "recipes";
  if (pathname.startsWith(INGREDIENT_CATEGORIES_PATH)) return "categories";
  return "library";
}

export function ingredientTabPath(tab: IngredientSubTab): string {
  if (tab === "categories") return INGREDIENT_CATEGORIES_PATH;
  if (tab === "recipes") return INGREDIENT_RECIPES_PATH;
  return INGREDIENT_LIST_PATH;
}

export function ingredientTabLocation(path: string, search: string): { pathname: string; search: string } {
  return { pathname: path, search };
}

const tabs: Array<{
  id: IngredientSubTab;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof Package;
}> = [
  {
    id: "library",
    path: INGREDIENT_LIST_PATH,
    titleKey: "ingredient.tab.library",
    fallbackTitle: "Library",
    icon: Package,
  },
  {
    id: "categories",
    path: INGREDIENT_CATEGORIES_PATH,
    titleKey: "ingredient.tab.categories",
    fallbackTitle: "Categories",
    icon: Tag,
  },
  {
    id: "recipes",
    path: INGREDIENT_RECIPES_PATH,
    titleKey: "ingredient.tab.recipes",
    fallbackTitle: "Recipes",
    icon: BookOpen,
  },
];

export function IngredientHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const activeTab = ingredientTabFromPathname(location.pathname);

  const title = t("ingredient.header.title", "Ingredient");
  const description = t(
    "ingredient.header.subtitle",
    "Manage ingredients, categories, and recipes",
  );

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={title}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const locked = isTabLocked(tab.path);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => {
                  if (locked) return;
                  navigate(ingredientTabLocation(tab.path, location.search));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (locked) return;
                    navigate(ingredientTabLocation(tab.path, location.search));
                  }
                }}
                className={`flex items-center space-x-1.5 px-1 py-1.5 text-sm font-medium transition-colors ${
                  locked
                    ? "cursor-not-allowed border-b-2 border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "cursor-pointer border-b-2 border-primary text-primary"
                      : "cursor-pointer border-b-2 border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                title={
                  locked
                    ? t("ingredient.header.noAccess", "You do not have access to this page")
                    : label
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5" /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

IngredientHeaderAndTab.displayName = "IngredientHeaderAndTab";
