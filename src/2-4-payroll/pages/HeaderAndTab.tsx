import { useNavigate, useLocation } from "react-router-dom";
import { FileText } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";

const CALCULATIONS_ROUTE = "/payroll/calculations";

export function HeaderAndTab() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isCalculations = location.pathname.startsWith(CALCULATIONS_ROUTE);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="text-foreground mb-0.5 text-xl font-bold">{t("sidebar.humanResources.payroll.title")}</h1>
        <p className="text-muted-foreground text-xs">{t("sidebar.humanResources.payroll.description")}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={CALCULATIONS_ROUTE}
            label={t("payroll.page.tabCalculations")}
            icon={FileText}
            isActive={isCalculations}
            onActivate={() => navigate(CALCULATIONS_ROUTE)}
          />
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "HeaderAndTab";
