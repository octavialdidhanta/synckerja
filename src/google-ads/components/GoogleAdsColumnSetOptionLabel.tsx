import { cn } from "@/shared/lib/utils";
import type { GoogleAdsColumnSet } from "@/google-ads/hooks/useGoogleAdsColumnSets";

type Props = {
  set: Pick<GoogleAdsColumnSet, "name" | "scope">;
  className?: string;
};

/** Dropdown label for a column set — scope shown as a minimal text suffix. */
export function GoogleAdsColumnSetOptionLabel({ set, className }: Props) {
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

/** Hide Radix check indicator; hover/highlight shows selection. */
export const GOOGLE_ADS_COLUMN_SET_SELECT_ITEM_CLASS =
  "pl-2 pr-2 [&>span:first-child]:hidden";
