import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calculator, Lock, Percent, Tag } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";

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
  const { isTabLocked } = useHeaderTabPageAccess();

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
            const locked = isTabLocked(tab.path);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                title={
                  locked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : undefined
                }
                className={`flex items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  locked
                    ? "border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

PricingToolsHeaderAndTab.displayName = "PricingToolsHeaderAndTab";
