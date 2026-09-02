import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CUSTOMERS_FEEDBACK_PATH } from "./CustomersHeaderAndTab";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith(CUSTOMERS_FEEDBACK_PATH)) {
    return { key: "customers.tab.feedback", fallback: "Feedback" };
  }
  return { key: "customers.tab.list", fallback: "Customers List" };
}

export function CustomersPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("customers.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("customers.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
