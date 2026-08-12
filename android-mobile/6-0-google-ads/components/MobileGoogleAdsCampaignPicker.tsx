import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/mobile-app/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { findSelectedGoogleAdsFilterOption } from "@/google-ads/metrics/findSelectedGoogleAdsFilterOption";
import type { GoogleAdsCampaignListItem } from "@/google-ads/metrics/filterTypes";

type Props = {
  campaigns: GoogleAdsCampaignListItem[];
  value: string | null;
  onChange: (campaignId: string | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Mobile campaign filter (bottom sheet + search).
 * Options come from shared `useGoogleAdsCampaignList` — same source as desktop.
 */
export function MobileGoogleAdsCampaignPicker({
  campaigns,
  value,
  onChange,
  isLoading,
  disabled,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const count = campaigns.length;
  const selected = useMemo(
    () => findSelectedGoogleAdsFilterOption(value, campaigns),
    [value, campaigns],
  );

  const countLabel = t(
    "digitalMarketing.googleAds.filterCampaignsCount",
    "Campaigns ({{count}})",
    { count },
  );
  const allLabel = t("digitalMarketing.googleAds.filterAllCampaigns", "All campaigns");
  const viewAllLabel = t(
    "digitalMarketing.googleAds.filterViewAllCampaigns",
    "View all {{count}} campaigns",
    { count },
  );
  const searchPlaceholder = t(
    "digitalMarketing.googleAds.filterSearchCampaigns",
    "Search {{count}} campaigns",
    { count },
  );
  return (
    <div className={cn("w-full", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-auto min-h-9 w-full flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal",
          selected && "border-primary/30 bg-primary/[0.04]",
        )}
        disabled={disabled || isLoading}
        onClick={() => setOpen(true)}
        aria-label={t("digitalMarketing.googleAds.filterCampaignLabel", "Campaign")}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {countLabel}
        </span>
        <span className="flex w-full min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {isLoading ? (
              <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
            ) : selected ? (
              selected.name
            ) : (
              allLabel
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">{countLabel}</DrawerTitle>
          </DrawerHeader>
          <Command className="rounded-none border-0 bg-transparent">
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[min(60vh,360px)] px-1">
              <CommandEmpty>
                {t("digitalMarketing.googleAds.filterNoCampaigns", "No campaigns found.")}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={viewAllLabel}
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">{viewAllLabel}</span>
                </CommandItem>
              </CommandGroup>
              {campaigns.length > 0 ? <CommandSeparator /> : null}
              <CommandGroup
                heading={t("digitalMarketing.googleAds.filterCampaignLabel", "Campaign")}
              >
                {campaigns.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={`${opt.name} ${opt.status ?? ""}`}
                    onSelect={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === opt.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{opt.name}</p>
                      {opt.status ? (
                        <p className="truncate text-xs uppercase text-muted-foreground">
                          {opt.status}
                        </p>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
