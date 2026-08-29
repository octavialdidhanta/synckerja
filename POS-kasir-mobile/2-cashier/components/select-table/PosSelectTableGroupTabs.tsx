import { cn } from "@/shared/lib/utils";
import type { PosTableGroup } from "@/8-2-9-table-management/lib/posTableGroupTypes";

type Props = {
  groups: PosTableGroup[];
  activeGroupId: string | null;
  occupiedByGroupId: Map<string, number>;
  tableCountByGroupId: Map<string, number>;
  onSelectGroup: (groupId: string) => void;
};

export function PosSelectTableGroupTabs({
  groups,
  activeGroupId,
  occupiedByGroupId,
  tableCountByGroupId,
  onSelectGroup,
}: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto bg-primary px-2 py-2">
      {groups.map((group) => {
        const active = group.id === activeGroupId;
        const occupied = occupiedByGroupId.get(group.id) ?? 0;
        const total = tableCountByGroupId.get(group.id) ?? 0;
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
            className={cn(
              "shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "text-primary-foreground/80 hover:bg-primary-foreground/10",
            )}
          >
            {group.name} {occupied}/{total}
          </button>
        );
      })}
    </div>
  );
}
