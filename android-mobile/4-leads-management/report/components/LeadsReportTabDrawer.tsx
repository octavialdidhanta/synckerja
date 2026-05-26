import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/mobile-app/components/ui/sheet";
import { Separator } from "@/mobile-app/components/ui/separator";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  LEADS_REPORT_IDLE_TAB_ID,
  LEADS_REPORT_MAIN_TAB_IDS,
  type LeadsReportTabId,
} from "@/5-3-dashboard/leads-report";
import { getLeadsReportTabLabel } from "@/5-3-dashboard/leads-report/leadsReportTabLabels";
import {
  MOBILE_LEADS_BOTTOM_SHEET_FOOTER_SPACER_CLASS,
  MOBILE_LEADS_BOTTOM_SHEET_LIST_CLASS,
} from "../mobileLeadsReportLayout";

/** Selaras durasi `SheetContent` bottom (`duration-300` close). */
const TAB_CHANGE_AFTER_CLOSE_MS = 280;

type LeadsReportTabDrawerProps = {
  activeTab: string;
  onTabChange: (tab: LeadsReportTabId) => void;
};

/** Mobile report tab picker — bottom sheet (Overview / Source / Consultant). */
export function LeadsReportTabDrawer({ activeTab, onTabChange }: LeadsReportTabDrawerProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      LEADS_REPORT_MAIN_TAB_IDS.map((tabId) => ({
        value: tabId,
        label: getLeadsReportTabLabel(t, tabId),
      })),
    [t],
  );

  const activeLabel = getLeadsReportTabLabel(t, activeTab);

  const handleSelect = (tabId: LeadsReportTabId) => {
    if (tabId === activeTab) {
      setOpen(false);
      return;
    }
    setOpen(false);
    window.setTimeout(() => onTabChange(tabId), TAB_CHANGE_AFTER_CLOSE_MS);
  };

  if (activeTab === LEADS_REPORT_IDLE_TAB_ID) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-between text-sm font-normal"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="truncate text-foreground">{activeLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0 [&>button]:hidden"
          underSafeArea
        >
          <div className="flex shrink-0 justify-center pb-1 pt-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
          </div>
          <SheetHeader className="flex shrink-0 flex-col gap-0 bg-primary px-4 py-3 text-primary-foreground">
            <SheetTitle className="text-center text-base font-semibold text-primary-foreground">
              {t("leadsManagement.reportSummary.selectReportView", "Report view")}
            </SheetTitle>
          </SheetHeader>
          <Separator className="shrink-0 bg-primary/20" />
          <div className={MOBILE_LEADS_BOTTOM_SHEET_LIST_CLASS}>
            <div className="space-y-1">
              {options.map((opt) => {
                const isActive = opt.value === activeTab;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/10 font-medium text-primary"
                        : "border-border bg-card hover:bg-muted/50",
                    )}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={MOBILE_LEADS_BOTTOM_SHEET_FOOTER_SPACER_CLASS} aria-hidden />
        </SheetContent>
      </Sheet>
    </>
  );
}
