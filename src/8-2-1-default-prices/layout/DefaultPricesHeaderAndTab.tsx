import { Package, Tag, Lock } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export const DEFAULT_PRICES_PATH = "/tools/default-prices";

export type CatalogSubTab = "services" | "products";

export function catalogTabFromSearch(search: string): CatalogSubTab {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("tab") === "products" ? "products" : "services";
}

export function catalogTabPath(tab: CatalogSubTab): string {
  return tab === "products" ? `${DEFAULT_PRICES_PATH}?tab=products` : DEFAULT_PRICES_PATH;
}

const tabs: Array<{
  id: CatalogSubTab;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof Tag;
}> = [
  {
    id: "services",
    titleKey: "defaultPrices.tab.services",
    fallbackTitle: "Services",
    icon: Tag,
  },
  {
    id: "products",
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
  const locked = isTabLocked(DEFAULT_PRICES_PATH);
  const activeTab = catalogTabFromSearch(location.search);

  const title = t("sidebar.tools.defaultPrices.title", "Products & Services");
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
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => navigate(catalogTabPath(tab.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(catalogTabPath(tab.id));
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
