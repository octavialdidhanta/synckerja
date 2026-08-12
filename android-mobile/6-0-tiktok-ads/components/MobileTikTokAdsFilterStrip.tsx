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
import { MobileTrafficDateRangeDrawer } from "@/mobile/6-0-web-traffic/components/MobileTrafficDateRangeDrawer";
import { MobileTikTokAdsColumnSetPicker } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsColumnSetPicker";
import { MobileTikTokAdsEntityPicker } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsEntityPicker";
import { MobileTikTokAdsSortPickers } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsSortPickers";
import type { TikTokAdsColumnSet } from "@/tiktok-ads/hooks/useTikTokAdsColumnSets";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type {
  TikTokAdsMetricsSort,
  TikTokAdsSortColumnOption,
} from "@/tiktok-ads/metrics/tiktokAdsSortColumns";

type AccountOption = {
  id: string;
  label: string | null;
  advertiser_id: string;
};

type Props = {
  accounts: AccountOption[];
  advertiserId: string;
  onAdvertiserIdChange: (advertiserId: string) => void;
  accountsLoading?: boolean;
  dateSelection: GoogleAdsDateRangeSelection;
  onDateSelectionChange: (value: GoogleAdsDateRangeSelection) => void;
  filtersHydrated: boolean;
  calendarYearPresetYears?: number[];
  allTimeHint?: string;
  onCustomDateClick: () => void;
  entity: TikTokAdsMetricEntity;
  onEntityChange: (entity: TikTokAdsMetricEntity) => void;
  showEntity?: boolean;
  columnSets: TikTokAdsColumnSet[];
  activeColumnSetId: string | undefined;
  onColumnSetSelect: (setId: string) => void;
  columnSetDisabled?: boolean;
  columnSetLoading?: boolean;
  showColumnSet?: boolean;
  sort?: TikTokAdsMetricsSort;
  sortColumnOptions?: TikTokAdsSortColumnOption[];
  onSortFieldChange?: (field: string) => void;
  onSortDirectionChange?: (direction: "asc" | "desc") => void;
  showSort?: boolean;
  className?: string;
};

/**
 * Full-bleed horizontal filter strip (Meta mobile parity):
 * Account · Date · Level · Column set · Sort (no Campaign).
 */
export function MobileTikTokAdsFilterStrip({
  accounts,
  advertiserId,
  onAdvertiserIdChange,
  accountsLoading,
  dateSelection,
  onDateSelectionChange,
  filtersHydrated,
  calendarYearPresetYears,
  allTimeHint,
  onCustomDateClick,
  entity,
  onEntityChange,
  showEntity = true,
  columnSets,
  activeColumnSetId,
  onColumnSetSelect,
  columnSetDisabled,
  columnSetLoading,
  showColumnSet = true,
  sort,
  sortColumnOptions = [],
  onSortFieldChange,
  onSortDirectionChange,
  showSort = false,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [accountOpen, setAccountOpen] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.advertiser_id === advertiserId) ?? null,
    [accounts, advertiserId],
  );

  const accountLabel =
    activeAccount?.label?.trim() ||
    activeAccount?.advertiser_id ||
    t("digitalMarketing.tiktokAds.advertiser", "Advertiser");

  return (
    <div className={cn("-mx-2 border-y border-border bg-card", className)}>
      <div
        className={cn(
          "scrollbar-hide seamless-scroll min-w-0 overflow-x-auto overflow-y-hidden",
          "[touch-action:pan-x] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <div className="inline-flex items-center gap-2 py-2">
          <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 max-w-[11rem] shrink-0 flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
            disabled={accountsLoading || accounts.length === 0}
            onClick={() => setAccountOpen(true)}
            aria-label={t("digitalMarketing.tiktokAds.advertiser", "Advertiser")}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("digitalMarketing.tiktokAds.advertiser", "Advertiser")}
            </span>
            <span className="flex w-full min-w-0 items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {accountLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </span>
          </Button>

          <div className="min-w-[11rem] max-w-[16rem] shrink-0">
            <MobileTrafficDateRangeDrawer
              value={dateSelection}
              onChange={onDateSelectionChange}
              filtersHydrated={filtersHydrated}
              calendarYearPresetYears={calendarYearPresetYears}
              allTimeHint={allTimeHint}
              onCustomClick={onCustomDateClick}
              fieldLabel={t("digitalMarketing.tiktokAds.dateRangeLabel", "Date range")}
              triggerClassName="h-auto min-h-9 w-full max-w-[16rem] flex-col items-start gap-0 px-3 py-1.5 text-xs font-normal"
            />
          </div>

          {showEntity ? (
            <div className="min-w-[9rem] max-w-[12rem] shrink-0">
              <MobileTikTokAdsEntityPicker
                entity={entity}
                onEntityChange={onEntityChange}
              />
            </div>
          ) : null}

          {showColumnSet ? (
            <div className="min-w-[12rem] max-w-[16rem] shrink-0">
              <MobileTikTokAdsColumnSetPicker
                columnSets={columnSets}
                activeId={activeColumnSetId}
                onSelect={onColumnSetSelect}
                disabled={columnSetDisabled}
                isLoading={columnSetLoading}
              />
            </div>
          ) : null}

          {showSort && sort && onSortFieldChange && onSortDirectionChange ? (
            <MobileTikTokAdsSortPickers
              sort={sort}
              sortColumnOptions={sortColumnOptions}
              onSortFieldChange={onSortFieldChange}
              onSortDirectionChange={onSortDirectionChange}
            />
          ) : null}

          <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
        </div>
      </div>

      <Drawer open={accountOpen} onOpenChange={setAccountOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.tiktokAds.advertiser", "Advertiser")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2">
            {accounts.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {t("digitalMarketing.tiktokAds.filterNoAccounts", "No accounts found.")}
              </p>
            ) : (
              accounts.map((a) => {
                const label = a.label?.trim() || a.advertiser_id;
                const isActive = a.advertiser_id === advertiserId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted/60",
                    )}
                    onClick={() => {
                      onAdvertiserIdChange(a.advertiser_id);
                      setAccountOpen(false);
                    }}
                  >
                    <span className="truncate">{label}</span>
                  </button>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
