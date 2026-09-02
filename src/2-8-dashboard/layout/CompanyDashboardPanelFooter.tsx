import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { COMPANY_CARD_FOOTER } from "./companyModuleLayout";

type Props = {
  count?: number;
};

export function CompanyDashboardPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const sectionLabel = t("company.tabs.dashboard", "Dashboard");

  return (
    <div className={COMPANY_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("company.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("company.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
