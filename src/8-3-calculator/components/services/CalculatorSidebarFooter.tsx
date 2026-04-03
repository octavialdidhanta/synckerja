import { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface CalculatorSidebarFooterProps {
  actionSlot?: ReactNode;
}

const CalculatorSidebarFooter = ({ actionSlot }: CalculatorSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex items-center justify-between border-t border-primary/15 bg-brand-blue-soft/80 px-4 py-2 text-xs text-brand-blue-on-soft">
      <span>
        {t(
          "pages.calculator.footer.tutorialReminder",
          "Need help? Review the tutorial steps on the right."
        )}
      </span>
      {actionSlot ? (
        <div className="flex items-center space-x-2">{actionSlot}</div>
      ) : (
        <span className="text-muted-foreground">
          {t("pages.calculator.footer.autoUpdate", "Guides update based on the selected tab.")}
        </span>
      )}
    </div>
  );
};

CalculatorSidebarFooter.displayName = "CalculatorSidebarFooter";

export default CalculatorSidebarFooter;

