import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calculator, Percent, Tag } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDepartmentAccess } from "@/shared/layouts/sidebar/useDepartmentAccess";

const DEFAULT_PRICES_PATH = "/tools/default-prices";
const PRICING_TOOLS_PATH = "/tools/pricing-tools";
const PROMO_SIMULATION_PATH = "/tools/promo-simulation";

const tabs = [
  {
    id: "default-prices" as const,
    path: DEFAULT_PRICES_PATH,
    titleKey: "sidebar.tools.defaultPrices.title",
    fallbackTitle: "Default Prices",
    icon: Tag,
  },
  {
    id: "pricing" as const,
    path: PRICING_TOOLS_PATH,
    titleKey: "sidebar.tools.pricingTools.title",
    fallbackTitle: "Alat Harga",
    icon: Calculator,
  },
  {
    id: "promo-simulation" as const,
    path: PROMO_SIMULATION_PATH,
    titleKey: "sidebar.tools.promoSimulation.title",
    fallbackTitle: "Simulasi Promo",
    icon: Percent,
  },
];

/**
 * Header + cross-links ke tool harga terkait yang sudah ada di app (default prices ↔ pricing tools).
 */
export function PricingToolsHeaderAndTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();
  const { canAccessPage } = useDepartmentAccess();

  const activeId = useMemo(() => {
    if (location.pathname.startsWith(PROMO_SIMULATION_PATH)) return "promo-simulation";
    if (location.pathname.startsWith(PRICING_TOOLS_PATH)) return "pricing";
    if (location.pathname.startsWith(DEFAULT_PRICES_PATH)) return "default-prices";
    return "pricing";
  }, [location.pathname]);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t("pricingTools.header.title", "Alat Harga")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t(
            "pricingTools.header.subtitle",
            "Analisis skenario harga dan profitabilitas",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={t("pricingTools.header.toolsNav", "Navigasi alat harga")}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeId === tab.id;
            const locked = !canAccessPage(tab.path);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <button
                key={tab.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!locked) navigate(tab.path);
                }}
                className={`flex items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
                  locked
                    ? "cursor-not-allowed border-transparent text-muted-foreground opacity-50"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

PricingToolsHeaderAndTab.displayName = "PricingToolsHeaderAndTab";
