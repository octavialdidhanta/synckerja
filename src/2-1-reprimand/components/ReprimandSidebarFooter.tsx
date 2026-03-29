import React from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandSidebarFooterProps {
  totalReprimands: number;
  activeReprimands: number;
  thisMonthReprimands: number;
}

export const ReprimandSidebarFooter = ({
  totalReprimands,
  activeReprimands,
  thisMonthReprimands: _thisMonthReprimands,
}: ReprimandSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("reprimands.sidebarFooter.total", "Total Reprimands:")} {totalReprimands}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("reprimands.sidebarFooter.active", "Active:")} {activeReprimands}
        </span>
      </div>
    </div>
  );
};
