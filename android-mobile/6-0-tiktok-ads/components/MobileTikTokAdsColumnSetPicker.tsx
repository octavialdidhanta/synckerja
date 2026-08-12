import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { TikTokAdsColumnSetOptionLabel } from "@/tiktok-ads/components/TikTokAdsColumnSetOptionLabel";
import type { TikTokAdsColumnSet } from "@/tiktok-ads/hooks/useTikTokAdsColumnSets";

type Props = {
  columnSets: TikTokAdsColumnSet[];
  activeId: string | undefined;
  onSelect: (setId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
};

export function MobileTikTokAdsColumnSetPicker({
  columnSets,
  activeId,
  onSelect,
  disabled,
  isLoading,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const columnSetLabel = t("digitalMarketing.tiktokAds.activeColumnSet", "Column set");

  const activeSet = useMemo(
    () => columnSets.find((s) => s.id === activeId) ?? null,
    [columnSets, activeId],
  );

  return (
    <div className={cn("w-full", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-auto min-h-9 w-full flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
        disabled={disabled || isLoading || columnSets.length === 0}
        onClick={() => setOpen(true)}
        aria-label={columnSetLabel}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {columnSetLabel}
        </span>
        <span className="flex w-full min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {isLoading ? (
              <span className="inline-block h-4 w-28 animate-pulse rounded bg-muted" />
            ) : activeSet ? (
              <TikTokAdsColumnSetOptionLabel set={activeSet} />
            ) : (
              t("digitalMarketing.tiktokAds.chooseColumnSet", "Choose a saved set")
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">{columnSetLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2">
            {columnSets.map((set) => {
              const isActive = set.id === activeId;
              return (
                <button
                  key={set.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => {
                    onSelect(set.id);
                    setOpen(false);
                  }}
                >
                  <TikTokAdsColumnSetOptionLabel set={set} />
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
