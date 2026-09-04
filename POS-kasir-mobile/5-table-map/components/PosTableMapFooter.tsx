import { Menu } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { PosTableGroup } from "@/8-2-9-table-management/lib/posTableGroupTypes";

type Props = {
  groups: PosTableGroup[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  outletLabel: string;
  onOpenMenu?: () => void;
  menuAriaLabel?: string;
  /** Hide the Menu button (e.g. Select Table overlay). */
  hideMenu?: boolean;
  occupiedByGroupId?: Map<string, number>;
  tableCountByGroupId?: Map<string, number>;
};

/**
 * Blue footer for Table Map / Select Table: optional Menu + group tabs (Indoor/Outdoor).
 * Height matches Point of Sale (`PosCashierBottomNav`): content `min-h-14`, safe-area below.
 */
export function PosTableMapFooter({
  groups,
  activeGroupId,
  onSelectGroup,
  outletLabel,
  onOpenMenu,
  menuAriaLabel = "Menu",
  hideMenu = false,
  occupiedByGroupId,
  tableCountByGroupId,
}: Props) {
  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-sm font-semibold text-white transition-colors",
      active
        ? "bg-white/25"
        : "bg-transparent hover:bg-white/15 active:bg-white/20",
    );

  const showMenu = !hideMenu && Boolean(onOpenMenu);

  return (
    <footer
      className={cn(
        "relative flex flex-shrink-0 flex-col bg-primary text-white safe-area-bottom",
      )}
    >
      <div className="flex min-h-14 items-stretch">
        {showMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex w-14 flex-shrink-0 flex-col items-center justify-center bg-brand-blue-deep text-white transition-colors hover:bg-brand-blue-deep/90 active:bg-brand-blue-deep"
            aria-label={menuAriaLabel}
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}

        {groups.length > 0 ? (
          <div className="scrollbar-hide flex min-w-0 flex-1 items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map((g) => {
              const occupied = occupiedByGroupId?.get(g.id);
              const total = tableCountByGroupId?.get(g.id);
              const countLabel =
                occupied != null && total != null ? ` ${occupied}/${total}` : "";
              return (
                <button
                  key={g.id}
                  type="button"
                  className={tabClass(g.id === activeGroupId)}
                  onClick={() => onSelectGroup(g.id)}
                >
                  <span className="truncate">
                    {g.name}
                    {countLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="flex min-w-0 flex-1 items-center justify-center truncate px-3 text-sm font-semibold">
            {outletLabel}
          </p>
        )}
      </div>
    </footer>
  );
}
