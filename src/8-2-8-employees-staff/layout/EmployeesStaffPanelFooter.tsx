import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EMPLOYEES_STAFF_ACCESS_PATH, EMPLOYEES_STAFF_PIN_PATH } from "./employeesStaffTabs";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith(EMPLOYEES_STAFF_PIN_PATH)) {
    return { key: "employeesStaff.tab.pinAccess", fallback: "PIN Access" };
  }
  if (pathname.startsWith(EMPLOYEES_STAFF_ACCESS_PATH)) {
    return { key: "employeesStaff.tab.access", fallback: "Employee Access" };
  }
  return { key: "employeesStaff.tab.slots", fallback: "Employee Slots" };
}

export function EmployeesStaffPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("employeesStaff.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("employeesStaff.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
