import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type Props = {
  outletLabel: string;
  /** Replaces the center outlet label (e.g. End Shift + Print in one row). */
  center?: ReactNode;
  onOpenMenu: () => void;
  menuAriaLabel?: string;
  className?: string;
};

/**
 * Phone overlay `bottom` so a full-bleed sheet sits flush above this bar
 * (`min-h-14` row + `.safe-area-bottom`).
 */
export const POS_APP_FOOTER_OVERLAY_BOTTOM_CLASS =
  "bottom-[calc(3.5rem+max(var(--safe-area-inset-bottom,0px),env(safe-area-inset-bottom,0px)))]";

/**
 * Full-width brand footer: Menu (left) + outlet name or custom center.
 * Content row is `min-h-14` like cashier; safe-area is extra below (not inside that height).
 */
export function PosAppFooterBar({
  outletLabel,
  center,
  onOpenMenu,
  menuAriaLabel = "Menu",
  className,
}: Props) {
  return (
    <footer
      className={cn(
        "relative flex flex-shrink-0 flex-col bg-primary text-white safe-area-bottom",
        className,
      )}
    >
      <div className="flex min-h-14 items-stretch">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex w-14 flex-shrink-0 flex-col items-center justify-center bg-brand-blue-deep text-white transition-colors hover:bg-brand-blue-deep/90 active:bg-brand-blue-deep"
          aria-label={menuAriaLabel}
        >
          <Menu className="h-5 w-5" />
        </button>
        {center ? (
          <div className="flex min-h-14 min-w-0 flex-1 items-stretch">{center}</div>
        ) : (
          <p className="flex min-w-0 flex-1 items-center justify-center truncate px-3 text-sm font-semibold">
            {outletLabel}
          </p>
        )}
      </div>
    </footer>
  );
}
