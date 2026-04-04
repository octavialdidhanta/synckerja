import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface KOLManagementSidebarFooterProps {
  totalCategories: number;
  selectedCategory?: string;
  totalKOLs: number;
}

export const KOLManagementSidebarFooter = ({
  totalCategories,
  selectedCategory,
  totalKOLs,
}: KOLManagementSidebarFooterProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {t("kolManagement.sidebar.footer.categories", "Categories")}:{" "}
          {totalCategories}
        </span>
        <span className="text-xs text-gray-400">
          {t("kolManagement.sidebar.footer.total", "Total")}: {totalKOLs}
        </span>
      </div>
    </div>
  );
};

