import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith("/attendance/settings")) {
    return { key: "layout.attendanceModule.tabSettings", fallback: "Settings" };
  }
  if (pathname.startsWith("/attendance/attendance")) {
    return { key: "layout.attendanceModule.tabRecords", fallback: "Attendance" };
  }
  return { key: "layout.attendanceModule.tabDashboard", fallback: "Dashboard" };
}

export function AttendancePanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("layout.attendanceModule.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("layout.attendanceModule.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
