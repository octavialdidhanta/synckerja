import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getOkrActiveTabFromPath, type OkrPageTabId } from "../utils/okrPaths";

type Props = {
  count?: number;
};

const SECTION_COPY: Record<OkrPageTabId, { key: string; fallback: string }> = {
  "company-objectives": { key: "layout.okr.tab.company", fallback: "Company Objective" },
  "department-objectives": { key: "layout.okr.tab.department", fallback: "Department Objective" },
  "individual-objectives": { key: "layout.okr.tab.individual", fallback: "Individual Objective" },
};

export function OkrPanelFooter({ count = 0 }: Props) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const section = SECTION_COPY[getOkrActiveTabFromPath(pathname)];
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("layout.okr.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("layout.okr.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
