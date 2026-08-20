import { Package, Tag, Lock } from "lucide-react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

/** Legacy URL; redirects to Library services/products. */
export const DEFAULT_PRICES_PATH = "/tools/default-prices";

export const LIBRARY_INDEX_PATH = "/operations/library";
export const LIBRARY_SERVICES_PATH = "/operations/library/service-list";
export const LIBRARY_PRODUCTS_PATH = "/operations/library/product-list";
export const LIBRARY_BUNDLES_PATH = "/operations/library/bundles";
export const LIBRARY_CATEGORIES_PATH = "/operations/library/categories";
export const LIBRARY_BRANDS_PATH = "/operations/library/brands";
export const LIBRARY_MODIFIERS_PATH = "/operations/library/modifiers";
export const LIBRARY_GRATUITY_PATH = "/operations/library/gratuity";
export const LIBRARY_DISCOUNTS_PATH = "/operations/library/discounts";
export const LIBRARY_PROMOS_PATH = "/operations/library/promos";
export const LIBRARY_SALES_TYPES_PATH = "/operations/library/sales-types";
export const LIBRARY_TAXES_PATH = "/operations/library/taxes";

export type CatalogSubTab =
  | "services"
  | "products"
  | "bundles"
  | "categories"
  | "brands"
  | "modifiers"
  | "gratuity"
  | "discounts"
  | "promos"
  | "sales-types"
  | "taxes";

export function catalogTabFromPathname(pathname: string): CatalogSubTab {
  if (pathname.startsWith(LIBRARY_TAXES_PATH)) return "taxes";
  if (pathname.startsWith(LIBRARY_SALES_TYPES_PATH)) return "sales-types";
  if (pathname.startsWith(LIBRARY_PROMOS_PATH)) return "promos";
  if (pathname.startsWith(LIBRARY_DISCOUNTS_PATH)) return "discounts";
  if (pathname.startsWith(LIBRARY_GRATUITY_PATH)) return "gratuity";
  if (pathname.startsWith(LIBRARY_MODIFIERS_PATH)) return "modifiers";
  if (pathname.startsWith(LIBRARY_BRANDS_PATH)) return "brands";
  if (pathname.startsWith(LIBRARY_CATEGORIES_PATH)) return "categories";
  if (pathname.startsWith(LIBRARY_BUNDLES_PATH)) return "bundles";
  if (pathname.startsWith(LIBRARY_PRODUCTS_PATH)) return "products";
  return "services";
}

export function catalogTabPath(tab: CatalogSubTab): string {
  if (tab === "products") return LIBRARY_PRODUCTS_PATH;
  if (tab === "bundles") return LIBRARY_BUNDLES_PATH;
  if (tab === "categories") return LIBRARY_CATEGORIES_PATH;
  if (tab === "brands") return LIBRARY_BRANDS_PATH;
  if (tab === "modifiers") return LIBRARY_MODIFIERS_PATH;
  if (tab === "gratuity") return LIBRARY_GRATUITY_PATH;
  if (tab === "discounts") return LIBRARY_DISCOUNTS_PATH;
  if (tab === "promos") return LIBRARY_PROMOS_PATH;
  if (tab === "sales-types") return LIBRARY_SALES_TYPES_PATH;
  if (tab === "taxes") return LIBRARY_TAXES_PATH;
  return LIBRARY_SERVICES_PATH;
}

export function LegacyDefaultPricesRedirect() {
  const [params] = useSearchParams();
  const to = params.get("tab") === "products" ? LIBRARY_PRODUCTS_PATH : LIBRARY_SERVICES_PATH;
  return <Navigate to={to} replace />;
}

const tabs: Array<{
  id: CatalogSubTab;
  path: string;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof Tag;
}> = [
  {
    id: "services",
    path: LIBRARY_SERVICES_PATH,
    titleKey: "defaultPrices.tab.services",
    fallbackTitle: "Services",
    icon: Tag,
  },
  {
    id: "products",
    path: LIBRARY_PRODUCTS_PATH,
    titleKey: "defaultPrices.tab.products",
    fallbackTitle: "Products",
    icon: Package,
  },
];

export function DefaultPricesHeaderAndTab() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const activeTab = catalogTabFromPathname(location.pathname);

  const title = t("defaultPrices.nav.itemLibrary", "Item Library");
  const description = t(
    "sidebar.tools.defaultPrices.description",
    "Services for lead conversion, products for retail and F&B",
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
                  navigate(tab.path);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (locked) return;
                    navigate(tab.path);
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
                    ? t("defaultPrices.header.noAccess", "Anda tidak memiliki akses ke halaman ini")
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

DefaultPricesHeaderAndTab.displayName = "DefaultPricesHeaderAndTab";
