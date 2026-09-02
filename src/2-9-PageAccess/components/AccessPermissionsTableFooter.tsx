import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface AccessPermissionsTableFooterProps {
  totalConfigurations: number;
}

export const AccessPermissionsTableFooter = ({
  totalConfigurations,
}: AccessPermissionsTableFooterProps) => {
  const { t } = useAppTranslation();
  const sectionLabel = t("pageAccess.tabs.pageAccess", "Page Access");

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("pageAccess.footer.showing", "Showing {{count}} {{section}}", {
            count: totalConfigurations,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("pageAccess.footer.total", "Total: {{count}}", { count: totalConfigurations })}
        </span>
      </div>
    </div>
  );
};
