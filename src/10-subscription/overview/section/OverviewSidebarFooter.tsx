import { memo } from "react";
import { useTranslation } from "react-i18next";

interface OverviewSidebarFooterProps {
  activeEmployees: number;
  totalFeatures: number;
}

export const OverviewSidebarFooter = memo(function OverviewSidebarFooter({
  activeEmployees,
  totalFeatures,
}: OverviewSidebarFooterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-10 min-w-0 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
      <div className="flex min-h-7 w-full min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("subscription.overview.sidebarFooterEmployees", { count: activeEmployees })}</span>
        <span className="text-muted-foreground/80">{t("subscription.overview.sidebarFooterFeatures", { count: totalFeatures })}</span>
      </div>
    </div>
  );
});
