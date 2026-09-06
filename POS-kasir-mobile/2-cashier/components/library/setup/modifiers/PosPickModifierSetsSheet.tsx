import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { useCatalogModifierGroups } from "@/8-2-1-default-prices/modifiers";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_CASHIER_I18N } from "../../../../lib/posCashierCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onCreateNew: () => void;
};

/** Pick existing BO modifier groups for the current outlet (phone drawer / tablet dialog). */
export function PosPickModifierSetsSheet({
  open,
  onOpenChange,
  outletId,
  selectedIds,
  onConfirm,
  onCreateNew,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const { rows, isLoading } = useCatalogModifierGroups();
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds);
    setQuery("");
  }, [open, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (outletId && row.outlet_ids?.length && !row.outlet_ids.includes(outletId)) {
        return false;
      }
      if (!q) return true;
      return row.name.toLowerCase().includes(q);
    });
  }, [rows, outletId, query]);

  const toggle = (id: string, checked: boolean) => {
    setDraftIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const titleText = t(POS_CASHIER_I18N.setupPickModifierSets, "Add Modifier Set");

  const header = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className={cn(POS_PANEL.header, "border-b-0")}>
        {isPhone ? (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
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

  const body = (
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
          <div className={cn(POS_PANEL.formRow, "relative")}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(POS_CASHIER_I18N.setupSearchModifiers, "Search")}
              className={cn(POS_PANEL.formInput, "pr-9")}
            />
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full border-slate-200 bg-white text-sm font-semibold text-slate-800"
          onClick={() => {
            onOpenChange(false);
            onCreateNew();
          }}
        >
          {t(POS_CASHIER_I18N.setupCreateModifierSet, "Create new modifier set")}
        </Button>

        {isLoading ? (
          <p className="px-0.5 py-6 text-center text-sm text-slate-500">
            {t(POS_CASHIER_I18N.setupModifiersLoading, "Loading…")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-0.5 py-6 text-center text-sm text-slate-500">
            {t(POS_CASHIER_I18N.setupModifiersEmpty, "No modifier sets for this outlet.")}
          </p>
        ) : (
          <div className={cn(POS_PANEL.card, "mt-3")}>
            {filtered.map((row) => (
              <label key={row.id} className={cn(POS_PANEL.formRow, "cursor-pointer")}>
                <span className={cn(POS_PANEL.rowLabel, "truncate")}>{row.name}</span>
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

  const footerButtons = (
    <div className="flex flex-row items-center justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1 border-slate-200 bg-white text-slate-800"
        onClick={() => onOpenChange(false)}
      >
        {t("common.cancel", "Cancel")}
      </Button>
      <Button
        type="button"
        className="h-11 flex-1 text-sm font-semibold"
        onClick={() => {
          onConfirm(draftIds);
          onOpenChange(false);
        }}
      >
        {t(POS_CASHIER_I18N.setupConfirmModifiers, "Confirm")}
      </Button>
    </div>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          followKeyboard={false}
          className={cn(
            drawerChrome.drawerClassName,
            "z-[90] rounded-t-2xl border-0 bg-slate-100 shadow-2xl",
          )}
          overlayClassName="z-[90]"
          style={drawerChrome.drawerMaxHeightStyle}
        >
          {header(
            <DrawerTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
              {titleText}
            </DrawerTitle>,
          )}
          {body}
          <div
            className="flex-shrink-0 border-t border-slate-200 bg-white px-2 pt-3 sm:px-2.5"
            style={drawerChrome.footerStyle}
          >
            {footerButtons}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="flex h-[min(72dvh,640px)] max-h-[min(72dvh,640px)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm sm:max-w-lg"
      >
        {header(
          <DialogTitle className={cn(POS_PANEL.headerTitle, "px-1 leading-none")}>
            {titleText}
          </DialogTitle>,
        )}
        {body}
        <DialogFooter className="flex flex-shrink-0 flex-row items-center justify-between gap-2 border-t border-slate-200 bg-white px-2 py-3 sm:justify-between sm:px-2.5">
          {footerButtons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
