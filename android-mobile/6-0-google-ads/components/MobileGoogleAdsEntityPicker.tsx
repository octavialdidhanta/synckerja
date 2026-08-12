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
  findGoogleAdsEntityNavItem,
  GOOGLE_ADS_ENTITY_NAV_GROUPS,
} from "@/google-ads/metrics/googleAdsEntityNavGroups";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

type Props = {
  entity: GoogleAdsMetricEntity;
  onEntityChange: (entity: GoogleAdsMetricEntity) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Mobile report-level picker (Campaigns / Ad groups / Ads / Keywords).
 * Uses shared {@link GOOGLE_ADS_ENTITY_NAV_GROUPS} — same as desktop sidebar.
 */
export function MobileGoogleAdsEntityPicker({
  entity,
  onEntityChange,
  disabled,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const activeItem = useMemo(() => findGoogleAdsEntityNavItem(entity), [entity]);
  const ActiveIcon = activeItem?.icon;
  const activeLabel = activeItem
    ? t(activeItem.labelKey, activeItem.defaultLabel)
    : t("digitalMarketing.googleAds.entityNavLabel", "Report level");

  return (
    <div className={cn("w-full", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-auto min-h-9 w-full flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={t("digitalMarketing.googleAds.entityNavAria", "Google Ads report navigation")}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("digitalMarketing.googleAds.entityNavLabel", "Report level")}
        </span>
        <span className="flex w-full min-w-0 items-center gap-1">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {ActiveIcon ? (
              <ActiveIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            ) : null}
            <span className="truncate text-xs font-medium text-foreground">{activeLabel}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.googleAds.entityNavLabel", "Report level")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2 pb-2">
            {GOOGLE_ADS_ENTITY_NAV_GROUPS.map((group, groupIndex) => (
              <div
                key={group.id}
                className={cn(groupIndex > 0 && "mt-3 border-t border-border pt-3")}
              >
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(group.sectionKey, group.sectionDefault)}
                </p>
                <ul className="space-y-0.5" role="list">
                  {group.items.map((item) => {
                    const isActive = entity === item.id;
                    const Icon = item.icon;
                    const label = t(item.labelKey, item.defaultLabel);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-muted/60",
                          )}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => {
                            onEntityChange(item.id);
                            setOpen(false);
                          }}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
