import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { useCatalogModifierGroups } from "@/8-2-1-default-prices/modifiers";
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

  const title = t(POS_CASHIER_I18N.setupPickModifierSets, "Add Modifier Set");

  const body = (
    <>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(POS_CASHIER_I18N.setupSearchModifiers, "Search")}
          className="pr-9"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          onOpenChange(false);
          onCreateNew();
        }}
      >
        {t(POS_CASHIER_I18N.setupCreateModifierSet, "Create new modifier set")}
      </Button>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t(POS_CASHIER_I18N.setupModifiersLoading, "Loading…")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t(POS_CASHIER_I18N.setupModifiersEmpty, "No modifier sets for this outlet.")}
        </p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((row) => (
            <li key={row.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
                <Checkbox
                  checked={draftIds.includes(row.id)}
                  onCheckedChange={(value) => toggle(row.id, value === true)}
                />
                <span className="min-w-0 flex-1 text-sm">{row.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        {t(POS_CASHIER_I18N.setupClose, "Close")}
      </Button>
      <Button
        type="button"
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
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className={drawerChrome.drawerClassName}
          overlayClassName="z-[90]"
          style={drawerChrome.drawerMaxHeightStyle}
        >
          <div
            className="flex-shrink-0 bg-primary px-4 py-3"
            style={drawerChrome.headerStyle}
          >
            <DrawerTitle className="text-center text-base font-semibold text-primary-foreground">
              {title}
            </DrawerTitle>
          </div>
          <div className={drawerChrome.listBodyClassName}>{body}</div>
          <div className="flex-shrink-0 border-t px-4 pt-3" style={drawerChrome.footerStyle}>
            {footer}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md [&>button]:hidden">
        <div className="bg-primary px-4 py-3">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {title}
          </DialogTitle>
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto p-4">{body}</div>
        <div className="border-t px-4 py-3">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
