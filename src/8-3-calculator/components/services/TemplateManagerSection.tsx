import TemplateManager from "./TemplateManager";
import { ServiceKPISettings, SalesKPISettings } from "@/8-3-calculator/types/kpi-templates";

interface TemplateManagerSectionProps {
  calculatorType: "services" | "sales";
  currentSettings: ServiceKPISettings | SalesKPISettings;
  onLoadTemplate: (settings: ServiceKPISettings | SalesKPISettings) => void;
  onSaveSuccess?: () => void;
}

export const TemplateManagerSection = ({
  calculatorType,
  currentSettings,
  onLoadTemplate,
  onSaveSuccess,
}: TemplateManagerSectionProps) => {
  return (
    <div className="flex-shrink-0 mb-2">
      <div className="rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">Template:</span>
            <TemplateManager
              calculatorType={calculatorType}
              currentSettings={currentSettings}
              onLoadTemplate={onLoadTemplate}
              onSaveSuccess={onSaveSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

