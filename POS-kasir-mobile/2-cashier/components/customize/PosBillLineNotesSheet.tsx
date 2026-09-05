import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { ORDER_KITCHEN_NOTE_MAX } from "@/synckerja-order/0-storefront/customize/lib/orderLineKitchenNote";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { POS_ITEM_CUSTOMIZE_I18N } from "../../lib/posItemCustomizeCopy";
import { posBillLineTitle } from "../../lib/posBillLineTitle";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

type Props = {
  open: boolean;
  line: CustomerVisitCartLine | null;
  onOpenChange: (open: boolean) => void;
  onSave: (lineKey: string, kitchenNote: string | null) => void;
};

/** Edit kitchen notes for an existing bill line (phone drawer / tablet dialog). */
export function PosBillLineNotesSheet({ open, line, onOpenChange, onSave }: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open || !line) return;
    setDraft(line.kitchenNote?.trim() ?? "");
  }, [open, line]);

  if (!line) return null;

  const title = t(POS_ITEM_CUSTOMIZE_I18N.notes, "Notes");
  const handleSave = () => {
    onSave(line.lineKey, draft);
    onOpenChange(false);
  };

  const body = (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">{posBillLineTitle(line)}</p>
      <textarea
        value={draft}
        maxLength={ORDER_KITCHEN_NOTE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary"
        placeholder={t(
          POS_ITEM_CUSTOMIZE_I18N.notesPlaceholder,
          "Example: less spicy, extra sauce…",
        )}
        autoFocus
      />
      <p className="text-right text-[10px] tabular-nums text-slate-400">
        {draft.length}/{ORDER_KITCHEN_NOTE_MAX}
      </p>
    </div>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        {t(POS_ITEM_CUSTOMIZE_I18N.cancel, "Cancel")}
      </Button>
      <Button type="button" onClick={handleSave}>
        {t(POS_ITEM_CUSTOMIZE_I18N.save, "Save")}
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
          <div className="flex-shrink-0 bg-primary px-4 py-3">
            <DrawerTitle className="text-center text-base font-semibold text-primary-foreground">
              {title}
            </DrawerTitle>
          </div>
          <div className={drawerChrome.bodyClassName}>{body}</div>
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
        <div className="p-4">{body}</div>
        <div className="border-t px-4 py-3">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
