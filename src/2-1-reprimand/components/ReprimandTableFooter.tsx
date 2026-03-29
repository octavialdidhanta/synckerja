import React from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandTableFooterProps {
  totalEmployees: number;
  totalReprimands: number;
  currentPage?: number;
  totalPages?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onPageChange?: (page: number) => void;
}

const ReprimandTableFooter: React.FC<ReprimandTableFooterProps> = ({ totalEmployees, totalReprimands }) => {
  const { t } = useAppTranslation();

  return (
    <div className="mt-4 flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("reprimands.tableFooter.totalEmployees", "Total Employees:")} {totalEmployees}
        </span>
        <span>
          {t("reprimands.tableFooter.totalReprimands", "Total Reprimands:")} {totalReprimands}
        </span>
      </div>
    </div>
  );
};

export { ReprimandTableFooter };
export default ReprimandTableFooter;
