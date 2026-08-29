import { ChevronLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";

type Props = {
  title: string;
  onBack: () => void;
};

/** Discount stub until cart wiring ships. Bundles use PosLibraryProductPane. */
export function PosLibrarySoonPane({ title, onBack }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="relative flex flex-shrink-0 items-center justify-center border-b border-slate-100 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 text-slate-600"
          aria-label={t(POS_CASHIER_I18N.libraryBack, "Back")}
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="max-w-[70%] truncate text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
        {t(POS_CASHIER_I18N.librarySoon, "Coming soon")}
      </div>
    </div>
  );
}
