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
import { GoogleAdsColumnSetOptionLabel } from "@/google-ads/components/GoogleAdsColumnSetOptionLabel";
import type { GoogleAdsColumnSet } from "@/google-ads/hooks/useGoogleAdsColumnSets";

type Props = {
  columnSets: GoogleAdsColumnSet[];
  activeId: string | undefined;
  onSelect: (setId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  /** Hide label; size for horizontal filter strip. */
  compact?: boolean;
};

/**
 * Mobile-only column-set picker (bottom sheet).
 * Uses shared `GoogleAdsColumnSetOptionLabel` + the same columnSets list as desktop.
 */
export function MobileGoogleAdsColumnSetPicker({
  columnSets,
  activeId,
  onSelect,
  disabled,
  isLoading,
  className,
  compact = false,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const activeSet = useMemo(
    () => columnSets.find((s) => s.id === activeId) ?? null,
    [columnSets, activeId],
  );

  const columnSetLabel = t("digitalMarketing.googleAds.activeColumnSet", "Column set");

  return (
    <div className={cn("w-full", className)}>
      {!compact ? (
        <p className="mb-1 text-xs text-muted-foreground">{columnSetLabel}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "w-full justify-between gap-1.5 px-3 text-left text-xs font-normal",
          compact
            ? "h-auto min-h-9 flex-col items-start gap-0 py-1.5"
            : "h-9",
        )}
        disabled={disabled || isLoading || columnSets.length === 0}
        onClick={() => setOpen(true)}
        aria-label={columnSetLabel}
      >
        {compact ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {columnSetLabel}
          </span>
        ) : null}
        <span className="flex w-full min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {isLoading ? (
              <span className="inline-block h-4 w-28 animate-pulse rounded bg-muted" />
            ) : activeSet ? (
              <GoogleAdsColumnSetOptionLabel set={activeSet} />
            ) : (
              t("digitalMarketing.googleAds.chooseColumnSet", "Choose a saved set")
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.googleAds.activeColumnSet", "Column set")}
            </DrawerTitle>
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
                  <GoogleAdsColumnSetOptionLabel set={set} />
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
