import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function ModifierSalesFootnote() {
  const { t } = useAppTranslation();

  return (
    <p className="mt-3 text-xs text-muted-foreground">
      {t(
        "reports.modifierSales.footnoteAdditive",
        "Modifier net sales reflect add-on revenue only and are a component of product sales, not the full bill total.",
      )}
    </p>
  );
}
