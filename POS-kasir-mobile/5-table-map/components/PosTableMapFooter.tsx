import { Menu } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { PosTableGroup } from "@/8-2-9-table-management/lib/posTableGroupTypes";

type Props = {
  groups: PosTableGroup[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  outletLabel: string;
  onOpenMenu: () => void;
  menuAriaLabel?: string;
};

/**
 * Single blue footer for Table Map: Menu + group tabs (Indoor/Outdoor) + outlet label.
 * Does not alter shared PosAppFooterBar used by Settings/Shift.
 */
export function PosTableMapFooter({
  groups,
  activeGroupId,
  onSelectGroup,
  outletLabel,
  onOpenMenu,
  menuAriaLabel = "Menu",
}: Props) {
  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 items-center justify-center px-2 py-2 text-sm font-semibold text-white transition-colors",
      active
        ? "bg-white/25"
        : "bg-transparent hover:bg-white/15 active:bg-white/20",
    );

  return (
    <footer
      className={cn(
        "flex flex-shrink-0 items-stretch bg-primary text-white",
        "safe-area-bottom min-h-14",
      )}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex w-14 flex-shrink-0 flex-col items-center justify-center bg-brand-blue-deep text-white transition-colors hover:bg-brand-blue-deep/90 active:bg-brand-blue-deep"
        aria-label={menuAriaLabel}
      >
        <Menu className="h-5 w-5" />
      </button>

      {groups.length > 0 ? (
        <div className="scrollbar-hide flex min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={tabClass(g.id === activeGroupId)}
              onClick={() => onSelectGroup(g.id)}
            >
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="flex min-w-0 flex-1 items-center justify-center truncate px-3 text-sm font-semibold">
          {outletLabel}
        </p>
      )}
    </footer>
  );
}
