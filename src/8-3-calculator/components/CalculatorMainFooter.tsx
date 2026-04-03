import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface CalculatorMainFooterProps {
  activeTab: "services" | "sales";
}

const CalculatorMainFooter = ({ activeTab }: CalculatorMainFooterProps) => {
  const { t } = useAppTranslation();

  const footerContent =
    activeTab === "sales"
      ? t(
          "pages.calculator.footer.salesHighlight",
          "Calculator Sales provides comprehensive sales funnel analysis and revenue projections.",
        )
      : t(
          "pages.calculator.footer.servicesHighlight",
          "Calculator Services provides separate calculators for Engagement, Traffic, and Conversion objectives.",
        );

  const reminder =
    activeTab === "sales"
      ? t("pages.calculator.footer.salesTemplateReminder", "Tip: Save templates to reuse your sales campaign settings.")
      : t(
          "pages.calculator.footer.servicesTemplateReminder",
          "Tip: Save templates separately for each calculator (Engagement, Traffic, Conversion).",
        );

  return (
    <div className="flex flex-col gap-1 border-t border-primary/15 bg-brand-blue-soft/80 px-4 py-2 text-xs text-brand-blue-on-soft sm:flex-row sm:items-center sm:justify-between">
      <span>{footerContent}</span>
      <span className="text-xs text-muted-foreground">{reminder}</span>
    </div>
  );
};

CalculatorMainFooter.displayName = "CalculatorMainFooter";

export default CalculatorMainFooter;
