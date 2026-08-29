import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";

type Props = {
  onDone: () => void;
};

/** Right panel while Favorit edit mode is active (replaces bill panel). */
export function PosFavoritesEditPanel({ onDone }: Props) {
  const { t } = useAppTranslation();
  return (
    <aside className="flex h-full min-h-0 w-full max-w-md flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm leading-relaxed text-slate-500">
          {t(
            POS_CASHIER_I18N.favoritEditHint,
            "Arrange your favorite and best-selling products on this page for faster checkout.",
          )}
        </p>
      </div>
      <div className="flex-shrink-0 p-4">
        <Button type="button" className="h-12 w-full text-base font-semibold" onClick={onDone}>
          {t(POS_CASHIER_I18N.favoritDone, "Done")}
        </Button>
      </div>
    </aside>
  );
}
