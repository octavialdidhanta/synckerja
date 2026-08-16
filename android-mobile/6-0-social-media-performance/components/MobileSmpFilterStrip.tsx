import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { MobileTrafficDateRangeDrawer } from "@/mobile/6-0-web-traffic/components/MobileTrafficDateRangeDrawer";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";

type AccountOption = { value: string; label: string };

type MobileSmpFilterStripProps = {
  accounts: AccountOption[];
  accountId: string;
  onAccountIdChange: (id: string) => void;
  accountsLoading?: boolean;
  dateSelection?: GoogleAdsDateRangeSelection;
  onDateSelectionChange?: (value: GoogleAdsDateRangeSelection) => void;
  filtersHydrated?: boolean;
  calendarYearPresetYears?: number[];
  onCustomDateClick?: () => void;
  showDate?: boolean;
  showAccount?: boolean;
  accountLabel?: string;
};

export function MobileSmpFilterStrip({
  accounts,
  accountId,
  onAccountIdChange,
  accountsLoading,
  dateSelection,
  onDateSelectionChange,
  filtersHydrated = true,
  calendarYearPresetYears,
  onCustomDateClick,
  showDate = true,
  showAccount = true,
  accountLabel,
}: MobileSmpFilterStripProps) {
  const { t } = useAppTranslation();
  const [accountOpen, setAccountOpen] = useState(false);
  const selected = accounts.find((a) => a.value === accountId);

  return (
    <div className="-mx-2 min-w-0 shrink-0 border-y border-border bg-card">
      <div className="nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-x-auto overflow-y-hidden px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex w-max items-center gap-2">
          {showAccount ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 max-w-[11rem] shrink-0 flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
            disabled={accountsLoading || accounts.length === 0}
            onClick={() => setAccountOpen(true)}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {accountLabel ??
                t("digitalMarketing.socialMediaInsightReport.colAccount", "Account")}
            </span>
            <span className="flex w-full min-w-0 items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {selected?.label || t("common.select", "Select")}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </span>
          </Button>
          ) : null}

          {showDate && dateSelection && onDateSelectionChange && onCustomDateClick ? (
            <div className="min-w-[11rem] max-w-[16rem] shrink-0">
              <MobileTrafficDateRangeDrawer
                value={dateSelection}
                onChange={onDateSelectionChange}
                filtersHydrated={filtersHydrated}
                calendarYearPresetYears={calendarYearPresetYears}
                onCustomClick={onCustomDateClick}
                fieldLabel={t("digitalMarketing.googleAds.dateRangeLabel", "Date range")}
                triggerClassName="h-auto min-h-9 w-full max-w-[16rem] flex-col items-start gap-0 px-3 py-1.5 text-xs font-normal"
              />
            </div>
          ) : null}
        </div>
      </div>

      <Drawer open={accountOpen} onOpenChange={setAccountOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">
              {accountLabel ??
                t("digitalMarketing.socialMediaInsightReport.colAccount", "Account")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2">
            {accounts.map((account) => {
              const isActive = account.value === accountId;
              return (
                <button
                  key={account.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => {
                    onAccountIdChange(account.value);
                    setAccountOpen(false);
                  }}
                >
                  <span className="truncate">{account.label}</span>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
