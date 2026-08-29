import { Menu } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Props = {
  outletLabel: string;
  onOpenMenu: () => void;
  menuAriaLabel?: string;
  className?: string;
};

/**
 * Full-width brand footer: Menu (left) + outlet name (center).
 * Used on POS settings (not the cashier Favorit/Library/Custom nav).
 */
export function PosAppFooterBar({
  outletLabel,
  onOpenMenu,
  menuAriaLabel = "Menu",
  className,
}: Props) {
  return (
    <footer
      className={cn(
        "relative flex h-14 flex-shrink-0 items-center bg-primary text-white safe-area-bottom",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="absolute left-0 top-0 flex h-full w-14 items-center justify-center transition-colors hover:bg-brand-blue-deep/80 active:bg-brand-blue-deep"
        aria-label={menuAriaLabel}
      >
        <Menu className="h-5 w-5" />
      </button>
      <p className="w-full truncate px-16 text-center text-sm font-semibold">{outletLabel}</p>
    </footer>
  );
}
