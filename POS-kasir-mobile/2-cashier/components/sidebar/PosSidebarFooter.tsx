import { LogOut, Store } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";

type Props = {
  onSwitchOutlet: () => void;
  onLogout: () => void;
};

const footerBtnClass = cn(
  "flex w-full min-h-12 items-center gap-3 px-4 text-left text-sm font-semibold text-white transition-colors",
  "hover:bg-brand-blue-deep/80 active:bg-brand-blue-deep",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40",
);

/**
 * Sticky bottom actions — switch outlet + logout (not part of main nav list).
 */
export function PosSidebarFooter({ onSwitchOutlet, onLogout }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-white/20 pb-[env(safe-area-inset-bottom)]">
      <button type="button" onClick={onSwitchOutlet} className={footerBtnClass}>
        <Store className="h-5 w-5 flex-shrink-0" aria-hidden />
        {t(POS_CASHIER_I18N.switchOutlet, "Switch outlet")}
      </button>
      <button type="button" onClick={onLogout} className={footerBtnClass}>
        <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden />
        {t(POS_CASHIER_I18N.logout, "Log out")}
      </button>
    </div>
  );
}
