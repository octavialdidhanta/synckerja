import { cn } from "@/shared/lib/utils";
import type { MetaAdsColumnSet } from "@/meta-ads/hooks/useMetaAdsColumnSets";

type Props = {
  set: Pick<MetaAdsColumnSet, "name" | "scope">;
  className?: string;
};

export function MetaAdsColumnSetOptionLabel({ set, className }: Props) {
  const isGlobal = set.scope === "global";
  return (
    <span className={cn("inline-flex w-max max-w-full items-baseline gap-1.5", className)}>
      <span className="break-words text-left">{set.name}</span>
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
