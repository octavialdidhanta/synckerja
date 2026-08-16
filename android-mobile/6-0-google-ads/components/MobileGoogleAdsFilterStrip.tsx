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
import { MobileGoogleAdsColumnSetPicker } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsColumnSetPicker";
import { MobileGoogleAdsCampaignPicker } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsCampaignPicker";
import { MobileGoogleAdsEntityPicker } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsEntityPicker";
import { MobileGoogleAdsSortPickers } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsSortPickers";
import { GoogleAdsDeliveryEnabledSwitches } from "@/6-0-google-ads/components/GoogleAdsDeliveryEnabledSwitches";
import type { GoogleAdsColumnSet } from "@/google-ads/hooks/useGoogleAdsColumnSets";
import type { GoogleAdsCampaignListItem } from "@/google-ads/metrics/filterTypes";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { SortColumnOption } from "@/google-ads/metrics/googleAdsSortColumns";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsMetricsSort,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";

type AccountOption = {
  id: string;
  label: string | null;
  customer_id: string;
};

type Props = {
  accounts: AccountOption[];
  customerId: string;
  onCustomerIdChange: (customerId: string) => void;
  accountsLoading?: boolean;
  dateSelection: GoogleAdsDateRangeSelection;
  onDateSelectionChange: (value: GoogleAdsDateRangeSelection) => void;
  filtersHydrated: boolean;
  accountEarliestYmd?: string | null;
  calendarYearPresetYears?: number[];
  onCustomDateClick: () => void;
  entity: GoogleAdsMetricEntity;
  onEntityChange: (entity: GoogleAdsMetricEntity) => void;
  showEntity?: boolean;
  campaigns: GoogleAdsCampaignListItem[];
  selectedCampaignId: string | null;
  onCampaignChange: (campaignId: string | null) => void;
  campaignsLoading?: boolean;
  showCampaign?: boolean;
  columnSets: GoogleAdsColumnSet[];
  activeColumnSetId: string | undefined;
  onColumnSetSelect: (setId: string) => void;
  columnSetDisabled?: boolean;
  columnSetLoading?: boolean;
  showColumnSet?: boolean;
  sort?: GoogleAdsMetricsSort;
  sortColumnOptions?: SortColumnOption[];
  metricItems?: MetricCatalogItem[];
  onSortFieldChange?: (field: string) => void;
  onSortDirectionChange?: (direction: "asc" | "desc") => void;
  showSort?: boolean;
  onlyRunning?: boolean;
  onOnlyRunningChange?: (checked: boolean) => void;
  enabledOnly?: boolean;
  onEnabledOnlyChange?: (checked: boolean) => void;
  showDeliveryEnabled?: boolean;
  showAccount?: boolean;
  className?: string;
};

/**
 * Full-bleed horizontal filter strip (scroll, not carousel):
 * Account · Date · Campaign · Report level · Column set · Sort · Delivery · Enabled.
 */
export function MobileGoogleAdsFilterStrip({
  accounts,
  customerId,
  onCustomerIdChange,
  accountsLoading,
  dateSelection,
  onDateSelectionChange,
  filtersHydrated,
  accountEarliestYmd,
  calendarYearPresetYears,
  onCustomDateClick,
  entity,
  onEntityChange,
  showEntity = true,
  campaigns,
  selectedCampaignId,
  onCampaignChange,
  campaignsLoading,
  showCampaign = true,
  columnSets,
  activeColumnSetId,
  onColumnSetSelect,
  columnSetDisabled,
  columnSetLoading,
  showColumnSet = true,
  sort,
  sortColumnOptions = [],
  metricItems = [],
  onSortFieldChange,
  onSortDirectionChange,
  showSort = false,
  onlyRunning = true,
  onOnlyRunningChange,
  enabledOnly = false,
  onEnabledOnlyChange,
  showDeliveryEnabled = false,
  showAccount = true,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [accountOpen, setAccountOpen] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.customer_id === customerId) ?? null,
    [accounts, customerId],
  );

  const accountLabel =
    activeAccount?.label?.trim() ||
    activeAccount?.customer_id ||
    t("digitalMarketing.googleAds.customerPlaceholder", "Select customer");

  return (
    <div className={cn("-mx-2 min-w-0 border-y border-border bg-card", className)}>
      <div
        className={cn(
          "nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-x-auto overflow-y-hidden",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <div className="inline-flex w-max items-center gap-2 py-2">
          <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
          {showAccount ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 max-w-[11rem] shrink-0 flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
            disabled={accountsLoading || accounts.length === 0}
            onClick={() => setAccountOpen(true)}
            aria-label={t("digitalMarketing.googleAds.customerLabel", "Account")}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("digitalMarketing.googleAds.customerLabel", "Account")}
            </span>
            <span className="flex w-full min-w-0 items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {accountLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </span>
          </Button>
          ) : null}

          <div className="min-w-[11rem] max-w-[16rem] shrink-0">
            <MobileTrafficDateRangeDrawer
              value={dateSelection}
              onChange={onDateSelectionChange}
              filtersHydrated={filtersHydrated}
              accountEarliestYmd={accountEarliestYmd}
              calendarYearPresetYears={calendarYearPresetYears}
              onCustomClick={onCustomDateClick}
              fieldLabel={t("digitalMarketing.googleAds.dateRangeLabel", "Date range")}
              triggerClassName="h-auto min-h-9 w-full max-w-[16rem] flex-col items-start gap-0 px-3 py-1.5 text-xs font-normal"
            />
          </div>

          {showCampaign ? (
            <div className="min-w-[12rem] max-w-[16rem] shrink-0">
              <MobileGoogleAdsCampaignPicker
                campaigns={campaigns}
                value={selectedCampaignId}
                onChange={onCampaignChange}
                isLoading={campaignsLoading}
              />
            </div>
          ) : null}

          {showEntity ? (
            <div className="min-w-[9rem] max-w-[12rem] shrink-0">
              <MobileGoogleAdsEntityPicker
                entity={entity}
                onEntityChange={onEntityChange}
              />
            </div>
          ) : null}

          {showColumnSet ? (
            <div className="min-w-[12rem] max-w-[16rem] shrink-0">
              <MobileGoogleAdsColumnSetPicker
                columnSets={columnSets}
                activeId={activeColumnSetId}
                onSelect={onColumnSetSelect}
                disabled={columnSetDisabled}
                isLoading={columnSetLoading}
                compact
              />
            </div>
          ) : null}

          {showSort && sort && onSortFieldChange && onSortDirectionChange ? (
            <MobileGoogleAdsSortPickers
              sort={sort}
              sortColumnOptions={sortColumnOptions}
              entity={entity}
              metricItems={metricItems}
              onSortFieldChange={onSortFieldChange}
              onSortDirectionChange={onSortDirectionChange}
            />
          ) : null}

          {showDeliveryEnabled && onOnlyRunningChange && onEnabledOnlyChange ? (
            <GoogleAdsDeliveryEnabledSwitches
              idPrefix="google-ads-mobile"
              onlyRunning={onlyRunning}
              onOnlyRunningChange={onOnlyRunningChange}
              enabledOnly={enabledOnly}
              onEnabledOnlyChange={onEnabledOnlyChange}
            />
          ) : null}

          <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
        </div>
      </div>

      {showAccount ? (
      <Drawer open={accountOpen} onOpenChange={setAccountOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {t("digitalMarketing.googleAds.customerLabel", "Account")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2">
            {accounts.map((a) => {
              const label = a.label?.trim() || a.customer_id;
              const isActive = a.customer_id === customerId;
              return (
                <button
                  key={a.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => {
                    onCustomerIdChange(a.customer_id);
                    setAccountOpen(false);
                  }}
                >
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
      ) : null}
    </div>
  );
}
