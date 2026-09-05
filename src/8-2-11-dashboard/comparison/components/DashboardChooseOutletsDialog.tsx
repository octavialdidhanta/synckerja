import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { usePosOutlets } from "@/8-2-2-outlets";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Input } from "@/shared/components/ui/input";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";

export const DASHBOARD_COMPARE_MIN_OUTLETS = 2;
export const DASHBOARD_COMPARE_MAX_OUTLETS = 5;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function DashboardChooseOutletsDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const { rows, isLoading } = usePosOutlets();
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds.slice(0, DASHBOARD_COMPARE_MAX_OUTLETS));
    setQuery("");
  }, [open, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [rows, query]);

  const canConfirm =
    draftIds.length >= DASHBOARD_COMPARE_MIN_OUTLETS
    && draftIds.length <= DASHBOARD_COMPARE_MAX_OUTLETS;

  const toggle = (id: string, checked: boolean) => {
    setDraftIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        if (prev.length >= DASHBOARD_COMPARE_MAX_OUTLETS) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(draftIds.slice(0, DASHBOARD_COMPARE_MAX_OUTLETS));
    handleOpenChange(false);
  };

  const header = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 bg-primary px-4 py-3" style={drawerChrome.headerStyle}>
      {titleNode}
    </div>
  );

  const list = (
    <>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("operationsDashboard.compare.search", "Search outlet")}
          className="pr-9"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "operationsDashboard.compare.selectHint",
          "Select {{min}}–{{max}} outlets to compare.",
          {
            min: DASHBOARD_COMPARE_MIN_OUTLETS,
            max: DASHBOARD_COMPARE_MAX_OUTLETS,
          },
        )}
      </p>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("outlets.loading", "Loading...")}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("outlets.assign.noActiveOutlets", "No outlets yet.")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("outlets.assign.noMatch", "No matching outlets.")}
        </p>
      ) : (
        <ul className={isPhone ? "space-y-1" : "max-h-56 space-y-1 overflow-y-auto"}>
          {filtered.map((row) => {
            const checked = draftIds.includes(row.id);
            const atMax = !checked && draftIds.length >= DASHBOARD_COMPARE_MAX_OUTLETS;
            return (
              <li key={row.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60",
                    atMax && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={atMax}
                    onCheckedChange={(value) => toggle(row.id, value === true)}
                  />
                  <span className="min-w-0 flex-1 text-sm">{row.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const footerInner = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">
          {t("operationsDashboard.compare.selectedCount", "Selected: {{count}}", {
            count: draftIds.length,
          })}
        </p>
        {!canConfirm ? (
          <p className="text-xs text-destructive">
            {t(
              "operationsDashboard.compare.minMax",
              "Please select between {{min}} and {{max}} outlets",
              {
                min: DASHBOARD_COMPARE_MIN_OUTLETS,
                max: DASHBOARD_COMPARE_MAX_OUTLETS,
              },
            )}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
          {t("operationsDashboard.compare.apply", "Apply")}
        </Button>
      </div>
    </div>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className={cn(
            "z-[80] flex flex-col gap-0 overflow-hidden p-0",
            drawerChrome.keyboardOpen ? "max-h-full" : "max-h-[90dvh]",
          )}
          overlayClassName="z-[80]"
          style={drawerChrome.drawerMaxHeightStyle}
        >
          {header(
            <DrawerTitle className="text-center text-base font-semibold text-primary-foreground">
              {t("operationsDashboard.compare.chooseTitle", "Choose Outlet")}
            </DrawerTitle>,
          )}
          <div className={drawerChrome.listBodyClassName}>{list}</div>
          <div className="flex-shrink-0 border-t px-4 pt-3" style={drawerChrome.footerStyle}>
            {footerInner}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {header(
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("operationsDashboard.compare.chooseTitle", "Choose Outlet")}
          </DialogTitle>,
        )}
        <div className="space-y-3 p-4">{list}</div>
        <DialogFooter className="flex-col items-stretch gap-2 border-t px-4 py-3 sm:flex-col sm:space-x-0">
          {footerInner}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
