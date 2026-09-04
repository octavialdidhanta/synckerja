import { Calculator, List, Menu, Star } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";

export type PosCashierTab = "favorit" | "library" | "custom";

type Props = {
  activeTab: PosCashierTab;
  onTabChange: (tab: PosCashierTab) => void;
  onOpenMenu: () => void;
};

/**
 * Footer warna utama brand. Active = highlight lebih terang; hover jelas.
 */
export function PosCashierBottomNav({ activeTab, onTabChange, onOpenMenu }: Props) {
  const { t } = useAppTranslation();

  const tabClass = (tab: PosCashierTab) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold text-white transition-colors",
      activeTab === tab
        ? "bg-white/25"
        : "bg-transparent hover:bg-white/15 active:bg-white/20",
    );

  return (
    <nav
      className={cn(
        "flex flex-shrink-0 flex-col bg-primary text-white safe-area-bottom",
      )}
    >
      <div className="flex min-h-14 items-stretch">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex w-14 flex-col items-center justify-center bg-brand-blue-deep text-white transition-colors hover:bg-brand-blue-deep/90 active:bg-brand-blue-deep"
          aria-label={t(POS_CASHIER_I18N.menu, "Menu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <button type="button" className={tabClass("favorit")} onClick={() => onTabChange("favorit")}>
          <Star className="h-4 w-4" />
          {t(POS_CASHIER_I18N.favorit, "Favorit")}
        </button>
        <button type="button" className={tabClass("library")} onClick={() => onTabChange("library")}>
          <List className="h-4 w-4" />
          {t(POS_CASHIER_I18N.library, "Library")}
        </button>
        <button type="button" className={tabClass("custom")} onClick={() => onTabChange("custom")}>
          <Calculator className="h-4 w-4" />
          {t(POS_CASHIER_I18N.custom, "Custom")}
        </button>
      </div>
    </nav>
  );
}
