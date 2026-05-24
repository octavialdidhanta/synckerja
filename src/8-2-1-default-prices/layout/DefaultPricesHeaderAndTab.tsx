import { Tag, Calculator, Lock } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const DEFAULT_PRICES_PATH = "/tools/default-prices";
const PRICING_TOOLS_PATH = "/tools/pricing-tools";

export type DefaultPricesHeaderAndTabProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

export function DefaultPricesHeaderAndTab({ activeTab, onTabChange }: DefaultPricesHeaderAndTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const { t } = useAppTranslation();

  const defaultLocked = isTabLocked(DEFAULT_PRICES_PATH);
  const pricingLocked = isTabLocked(PRICING_TOOLS_PATH);

  const defaultLabel = t("sidebar.tools.defaultPrices.title", "Default Prices");
  const pricingLabel = t("sidebar.tools.pricingTools.title", "Alat Harga");
  const description = t(
    "sidebar.tools.defaultPrices.description",
    "Set default unit price per service and category for lead conversion and workflows.",
  );

  const isDefaultActive =
    location.pathname.startsWith(DEFAULT_PRICES_PATH) || activeTab === "default-prices";
  const isPricingActive = location.pathname.startsWith(PRICING_TOOLS_PATH);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">{defaultLabel}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={t("defaultPrices.header.toolsNav", "Navigasi alat harga")}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              onTabChange("default-prices");
              navigate(DEFAULT_PRICES_PATH);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTabChange("default-prices");
                navigate(DEFAULT_PRICES_PATH);
              }
            }}
            className={`flex items-center space-x-1.5 px-1 py-1.5 text-sm font-medium transition-colors ${
              defaultLocked
                ? "cursor-not-allowed border-b-2 border-transparent text-muted-foreground opacity-60"
                : isDefaultActive
                  ? "cursor-pointer border-b-2 border-primary text-primary"
                  : "cursor-pointer border-b-2 border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            title={
              defaultLocked
                ? t("defaultPrices.header.noAccess", "Anda tidak memiliki akses ke halaman ini")
                : description
            }
          >
            <Tag className="h-4 w-4 shrink-0" />
            <span>{defaultLabel}</span>
            {defaultLocked ? <Lock className="ml-1 h-3.5 w-3.5" /> : null}
          </div>

          <button
            type="button"
            onClick={() => navigate(PRICING_TOOLS_PATH)}
            className={`flex items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
              pricingLocked
                ? "cursor-not-allowed border-transparent text-muted-foreground opacity-60"
                : isPricingActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            title={
              pricingLocked
                ? t("defaultPrices.header.noAccess", "Anda tidak memiliki akses ke halaman ini")
                : t("sidebar.tools.pricingTools.description", "Analisis skenario harga dan profitabilitas")
            }
          >
            <Calculator className="h-4 w-4 shrink-0" />
            <span>{pricingLabel}</span>
            {pricingLocked ? <Lock className="ml-1 h-3.5 w-3.5" /> : null}
          </button>
        </nav>
      </div>
    </div>
  );
}

DefaultPricesHeaderAndTab.displayName = "DefaultPricesHeaderAndTab";
