import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
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
import { usePosOutlets } from "../hooks/usePosOutlets";

export type AssignOutletsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignOutletsDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  selectedIds,
  onConfirm,
}: AssignOutletsDialogProps) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const { rows, isLoading } = usePosOutlets();
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

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
          placeholder={t("outlets.assign.search", "Search")}
          className="pr-9"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
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

  const footerInner = (
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
              {title}
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
            {title}
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
