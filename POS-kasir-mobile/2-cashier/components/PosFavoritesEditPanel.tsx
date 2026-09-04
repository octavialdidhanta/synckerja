import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";

type Props = {
  onDone: () => void;
  /** Phone: full width; use `compact` when stacked under the favorites grid. */
  fullWidth?: boolean;
  compact?: boolean;
};

/** Right panel while Favorit edit mode is active (replaces bill panel). */
export function PosFavoritesEditPanel({ onDone, fullWidth = false, compact = false }: Props) {
  const { t } = useAppTranslation();
  return (
    <aside
      className={cn(
        "flex min-h-0 w-full flex-col bg-slate-50",
        compact ? "flex-shrink-0 border-t border-slate-200" : "h-full",
        fullWidth ? "max-w-none border-l-0" : "max-w-md border-l border-slate-200",
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center",
          compact ? "px-4 py-2" : "min-h-0 flex-1 px-6",
        )}
      >
        <p className={cn("leading-relaxed text-slate-500", compact ? "text-xs" : "text-sm")}>
          {t(
            POS_CASHIER_I18N.favoritEditHint,
            "Arrange your favorite and best-selling products on this page for faster checkout.",
          )}
        </p>
      </div>
      <div className={cn("flex-shrink-0", compact ? "p-3" : "p-4")}>
        <Button type="button" className="h-12 w-full text-base font-semibold" onClick={onDone}>
          {t(POS_CASHIER_I18N.favoritDone, "Done")}
        </Button>
      </div>
    </aside>
  );
}
