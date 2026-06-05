import { cn } from "@/shared/lib/utils";
import type { MetaAdsColumnSet } from "@/meta-ads/hooks/useMetaAdsColumnSets";

type Props = {
  set: Pick<MetaAdsColumnSet, "name" | "scope">;
  className?: string;
};

export function MetaAdsColumnSetOptionLabel({ set, className }: Props) {
  const isGlobal = set.scope === "global";
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{set.name}</span>
      <span
        className={cn(
          "shrink-0 text-[10px] lowercase text-muted-foreground",
          !isGlobal && "opacity-70",
        )}
      >
        {isGlobal ? "default" : "org"}
      </span>
    </span>
  );
}

export const META_ADS_COLUMN_SET_SELECT_ITEM_CLASS =
  "pl-2 pr-2 [&>span:first-child]:hidden";
