import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import {
  getMetaAdsSortColumnKind,
  sortDirectionLabelKeys,
  type MetaAdsMetricsSort,
  type MetaAdsSortColumnOption,
} from "@/meta-ads/metrics/metaAdsSortColumns";

type Props = {
  sort: MetaAdsMetricsSort;
  sortColumnOptions: MetaAdsSortColumnOption[];
  onSortFieldChange: (field: string) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Compact sort field + direction triggers (CPA | High → low), drawer pickers.
 * Options come from {@link buildMetaAdsSortColumnOptions} (column-set filtered).
 */
export function MobileMetaAdsSortPickers({
  sort,
  sortColumnOptions,
  onSortFieldChange,
  onSortDirectionChange,
  disabled,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [fieldOpen, setFieldOpen] = useState(false);
  const [directionOpen, setDirectionOpen] = useState(false);

  const sortFieldValue = useMemo(() => {
    if (sortColumnOptions.some((o) => o.key === sort.field)) return sort.field;
    return sortColumnOptions[0]?.key ?? sort.field;
  }, [sort.field, sortColumnOptions]);

  const activeOption = sortColumnOptions.find((o) => o.key === sortFieldValue);
  const fieldLabel = activeOption
    ? t(activeOption.labelKey, activeOption.defaultLabel)
    : sortFieldValue;

  const sortKind = useMemo(
    () => getMetaAdsSortColumnKind(sortFieldValue),
    [sortFieldValue],
  );

  const directionLabels = useMemo(() => {
    const keys = sortDirectionLabelKeys(sortKind);
    return {
      desc: t(keys.descKey, keys.descDefault),
      asc: t(keys.ascKey, keys.ascDefault),
    };
  }, [sortKind, t]);

  const directionLabel =
    sort.direction === "asc" ? directionLabels.asc : directionLabels.desc;

  const triggerClass =
    "h-9 shrink-0 gap-1 px-3 text-xs font-normal touch-manipulation";

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(triggerClass, "max-w-[9rem]")}
        disabled={disabled || sortColumnOptions.length === 0}
        onClick={() => setFieldOpen(true)}
        aria-label={t("digitalMarketing.metaAds.sortBy", "Sort by")}
      >
        <span className="min-w-0 truncate">{fieldLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(triggerClass, "max-w-[8.5rem]")}
        disabled={disabled || sortColumnOptions.length === 0}
        onClick={() => setDirectionOpen(true)}
        aria-label={t("digitalMarketing.metaAds.sortDirection", "Sort direction")}
      >
        <span className="min-w-0 truncate">{directionLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </Button>

      <Drawer open={fieldOpen} onOpenChange={setFieldOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.metaAds.sortBy", "Sort by")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2 pb-2">
            {sortColumnOptions.map((option) => {
              const isActive = option.key === sortFieldValue;
              const label = t(option.labelKey, option.defaultLabel);
              return (
                <button
                  key={option.key}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => {
                    onSortFieldChange(option.key);
                    setFieldOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={directionOpen} onOpenChange={setDirectionOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.metaAds.sortDirection", "Sort direction")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-2 pb-2">
            {(
              [
                { value: "desc" as const, label: directionLabels.desc },
                { value: "asc" as const, label: directionLabels.asc },
              ] as const
            ).map((option) => {
              const isActive = sort.direction === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => {
                    onSortDirectionChange(option.value);
                    setDirectionOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
