import { useNavigate, useLocation } from "react-router-dom";
import { FileText } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

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
        <nav className="flex space-x-6">
          <button
            type="button"
            role="tab"
            aria-selected={isCalculations}
            onClick={() => navigate(CALCULATIONS_ROUTE)}
            className={cn(
              "flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
              isCalculations
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent hover:border-border",
            )}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            <FileText className="h-4 w-4" aria-hidden />
            <span>{t("payroll.page.tabCalculations")}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "HeaderAndTab";
