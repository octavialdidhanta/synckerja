import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Search } from "lucide-react";
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
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosOutlets } from "../hooks/usePosOutlets";

export type AssignOutletsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  /** POS create-item drawers: white header, slate canvas, card rows. */
  chrome?: "default" | "pos";
};

export function AssignOutletsDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  selectedIds,
  onConfirm,
  chrome = "default",
}: AssignOutletsDialogProps) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const { rows, isLoading } = usePosOutlets();
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const posChrome = chrome === "pos";

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds);
    setQuery("");
  }, [open, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [rows, query]);

  const filteredIds = filtered.map((row) => row.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => draftIds.includes(id));
  const canConfirm = draftIds.length >= 1;

  const toggle = (id: string, checked: boolean) => {
    setDraftIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const drop = new Set(filteredIds);
      setDraftIds((prev) => prev.filter((id) => !drop.has(id)));
      return;
    }
    setDraftIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(draftIds);
    handleOpenChange(false);
  };

  const searchField = (
    <div className="relative min-w-0 w-full flex-1">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("outlets.assign.search", "Search")}
        className={posChrome ? cn(POS_PANEL.formInput, "pr-9") : "pr-9"}
      />
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2",
          posChrome ? "right-4 text-slate-400" : "right-3 text-muted-foreground",
        )}
      />
    </div>
  );

  const emptyState = isLoading ? (
    <p className={cn("py-6 text-center text-sm", posChrome ? "px-0.5 text-slate-500" : "text-muted-foreground")}>
      {t("outlets.loading", "Loading...")}
    </p>
  ) : rows.length === 0 ? (
    <p className={cn("py-6 text-center text-sm", posChrome ? "px-0.5 text-slate-500" : "text-muted-foreground")}>
      {t("outlets.assign.noActiveOutlets", "No outlets yet.")}
    </p>
  ) : filtered.length === 0 ? (
    <p className={cn("py-6 text-center text-sm", posChrome ? "px-0.5 text-slate-500" : "text-muted-foreground")}>
      {t("outlets.assign.noMatch", "No matching outlets.")}
    </p>
  ) : null;

  const defaultHeader = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 bg-primary px-4 py-3" style={drawerChrome.headerStyle}>
      {titleNode}
    </div>
  );

  const posHeader = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className={cn(POS_PANEL.header, "border-b-0")}>
        {isPhone ? (
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className={POS_PANEL.headerBack}
            aria-label={t("common.cancel", "Cancel")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">{titleNode}</div>
      </div>
    </div>
  );

  const defaultList = (
    <>
      {searchField}
      <div className="flex items-center justify-between text-sm">
        <span>{t("outlets.assign.selectOutlet", "Select Outlet")}</span>
        <button
          type="button"
          className="text-primary disabled:text-muted-foreground"
          disabled={filteredIds.length === 0}
          onClick={handleSelectAllFiltered}
        >
          {allFilteredSelected
            ? t("outlets.assign.selectNone", "Select None")
            : t("outlets.assign.selectAll", "Select All")}
        </button>
      </div>
      {emptyState ?? (
        <ul className={isPhone ? "space-y-1" : "max-h-56 space-y-1 overflow-y-auto"}>
          {filtered.map((row) => (
            <li key={row.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
                <Checkbox
                  checked={draftIds.includes(row.id)}
                  onCheckedChange={(value) => toggle(row.id, value === true)}
                />
                <span className="min-w-0 flex-1 text-sm">{row.name}</span>
                {row.is_active ? null : (
                  <Badge variant="secondary">{t("outlets.statusInactive", "Inactive")}</Badge>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const posBody = (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100",
        "scrollbar-hide seamless-scroll nested-scroll-touch-chain",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      data-vaul-no-drag=""
    >
      <div className={POS_PANEL.body}>
        <div className={POS_PANEL.card}>
          <div className={cn(POS_PANEL.formRow, "relative")}>{searchField}</div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <p className={cn(POS_PANEL.sectionTitle, "pb-0 pt-0")}>
            {t("outlets.assign.selectOutlet", "Select Outlet")}
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-primary disabled:text-slate-400"
            disabled={filteredIds.length === 0}
            onClick={handleSelectAllFiltered}
          >
            {allFilteredSelected
              ? t("outlets.assign.selectNone", "Select None")
              : t("outlets.assign.selectAll", "Select All")}
          </button>
        </div>

        {emptyState ?? (
          <div className={POS_PANEL.card}>
            {filtered.map((row) => (
              <label key={row.id} className={cn(POS_PANEL.formRow, "cursor-pointer")}>
                <span className={cn(POS_PANEL.rowLabel, "truncate")}>{row.name}</span>
                {row.is_active ? null : (
                  <Badge variant="secondary">{t("outlets.statusInactive", "Inactive")}</Badge>
                )}
                <Checkbox
                  checked={draftIds.includes(row.id)}
                  onCheckedChange={(value) => toggle(row.id, value === true)}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const defaultFooter = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">
          {t("outlets.assign.selectedCount", "Selected Outlet: {{count}}", {
            count: draftIds.length,
          })}
        </p>
        {!canConfirm ? (
          <p className="text-xs text-destructive">
            {t("outlets.assign.minOne", "Please select minimum one outlet")}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );

  const posFooter = (
    <div className="space-y-2">
      <p className="px-0.5 text-sm text-slate-600">
        {t("outlets.assign.selectedCount", "Selected Outlet: {{count}}", {
          count: draftIds.length,
        })}
      </p>
      {!canConfirm ? (
        <p className="px-0.5 text-xs text-destructive">
          {t("outlets.assign.minOne", "Please select minimum one outlet")}
        </p>
      ) : null}
      <div className="flex flex-row items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 border-slate-200 bg-white text-slate-800"
          onClick={() => handleOpenChange(false)}
        >
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 text-sm font-semibold"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          followKeyboard={false}
          className={
            posChrome
              ? cn(
                  drawerChrome.drawerClassName,
                  "z-[90] rounded-t-2xl border-0 bg-slate-100 shadow-2xl",
                )
              : cn(
                  "z-[80] flex flex-col gap-0 overflow-hidden p-0",
                  drawerChrome.keyboardOpen ? "max-h-full" : "max-h-[90dvh]",
                )
          }
          overlayClassName={posChrome ? "z-[90]" : "z-[80]"}
          style={drawerChrome.drawerMaxHeightStyle}
        >
          {posChrome
            ? posHeader(
                <DrawerTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
                  {title}
                </DrawerTitle>,
              )
            : defaultHeader(
                <DrawerTitle className="text-center text-base font-semibold text-primary-foreground">
                  {title}
                </DrawerTitle>,
              )}
          {posChrome ? posBody : <div className={drawerChrome.listBodyClassName}>{defaultList}</div>}
          <div
            className={
              posChrome
                ? "flex-shrink-0 border-t border-slate-200 bg-white px-2 pt-3 sm:px-2.5"
                : "flex-shrink-0 border-t px-4 pt-3"
            }
            style={drawerChrome.footerStyle}
          >
            {posChrome ? posFooter : defaultFooter}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (posChrome) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          hideCloseButton
          className="flex h-[min(72dvh,640px)] max-h-[min(72dvh,640px)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm sm:max-w-lg"
        >
          {posHeader(
            <DialogTitle className={cn(POS_PANEL.headerTitle, "px-1 leading-none")}>
              {title}
            </DialogTitle>,
          )}
          {posBody}
          <DialogFooter className="flex flex-shrink-0 flex-col items-stretch gap-0 border-t border-slate-200 bg-white px-2 py-3 sm:px-2.5">
            {posFooter}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {defaultHeader(
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {title}
          </DialogTitle>,
        )}
        <div className="space-y-3 p-4">{defaultList}</div>
        <DialogFooter className="flex-col items-stretch gap-2 border-t px-4 py-3 sm:flex-col sm:space-x-0">
          {defaultFooter}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
