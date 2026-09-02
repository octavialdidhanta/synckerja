import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  TABLE_MANAGEMENT_MAP_PATH,
  TABLE_MANAGEMENT_REPORT_PATH,
} from "./tableManagementTabs";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith(TABLE_MANAGEMENT_MAP_PATH)) {
    return { key: "tableManagement.tab.map", fallback: "Table Map" };
  }
  if (pathname.startsWith(TABLE_MANAGEMENT_REPORT_PATH)) {
    return { key: "tableManagement.tab.report", fallback: "Table Report" };
  }
  return { key: "tableManagement.tab.group", fallback: "Table Group" };
}

export function TableManagementPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("tableManagement.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("tableManagement.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
