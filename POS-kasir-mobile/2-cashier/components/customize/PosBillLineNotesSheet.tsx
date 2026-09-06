import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { ORDER_KITCHEN_NOTE_MAX } from "@/synckerja-order/0-storefront/customize/lib/orderLineKitchenNote";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosKeyboardShellStyle } from "@/pos-mobile/shared/hooks/usePosKeyboardShellStyle";
import { PosSafeAreaBottomSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaBottomSpacer";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { useCapacitorKeyboardInset } from "@/shared/native/useCapacitorKeyboardInset";
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

function logNotesFlicker(event: string, extra?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const vv = window.visualViewport;
  console.warn(
    `pos-kb notes_${event} ${JSON.stringify({
      inner: window.innerHeight,
      vvH: vv ? Math.round(vv.height) : null,
      vvTop: vv ? Math.round(vv.offsetTop) : null,
      ...extra,
    })}`,
  );
}

/** Edit kitchen notes for an existing bill line (phone full page / tablet dialog). */
export function PosBillLineNotesSheet({ open, line, onOpenChange, onSave }: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const keyboardShellStyle = usePosKeyboardShellStyle({ enabled: isPhone && open });
  const { keyboardOpenNative } = useCapacitorKeyboardInset();
  const [draft, setDraft] = useState("");
  const [heldLine, setHeldLine] = useState(line);
  const [pendingClose, setPendingClose] = useState(false);
  const pendingCloseRef = useRef(false);

  useEffect(() => {
    if (line) setHeldLine(line);
  }, [line]);

  useEffect(() => {
    if (open) {
      pendingCloseRef.current = false;
      setPendingClose(false);
      return;
    }
    const timer = window.setTimeout(() => setHeldLine(null), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !line) return;
    setDraft(line.kitchenNote?.trim() ?? "");
  }, [open, line]);

  useEffect(() => {
    if (!pendingClose) return;
    if (keyboardOpenNative) return;
    logNotesFlicker("close_after_ime", { native: false });
    pendingCloseRef.current = false;
    setPendingClose(false);
    onOpenChange(false);
  }, [pendingClose, keyboardOpenNative, onOpenChange]);

  useEffect(() => {
    if (!pendingClose) return;
    const timer = window.setTimeout(() => {
      if (!pendingCloseRef.current) return;
      logNotesFlicker("close_timeout", { native: keyboardOpenNative });
      pendingCloseRef.current = false;
      setPendingClose(false);
      onOpenChange(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [pendingClose, keyboardOpenNative, onOpenChange]);

  const requestClose = () => {
    if (pendingCloseRef.current) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
    logNotesFlicker("close_request", { native: keyboardOpenNative });
    if (!isPhone || !keyboardOpenNative) {
      onOpenChange(false);
      return;
    }
    pendingCloseRef.current = true;
    setPendingClose(true);
  };

  const displayLine = line ?? heldLine;
  if (!displayLine) return null;

  const titleText = t(POS_ITEM_CUSTOMIZE_I18N.notes, "Notes");
  const handleSave = () => {
    onSave(displayLine.lineKey, draft);
    requestClose();
  };

  const header = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className={cn(POS_PANEL.header, "border-b-0")}>
        <button
          type="button"
          onClick={requestClose}
          className={POS_PANEL.headerBack}
          aria-label={t(POS_ITEM_CUSTOMIZE_I18N.cancel, "Cancel")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
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
    >
      <div className={POS_PANEL.body}>
        <p className={POS_PANEL.sectionTitle}>{posBillLineTitle(displayLine)}</p>
        <div className={POS_PANEL.card}>
          <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
            <textarea
              value={draft}
              maxLength={ORDER_KITCHEN_NOTE_MAX}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full resize-none border-0 bg-transparent px-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
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
        </div>
      </div>
    </div>
  );

  const footerButtons = (
    <div className="flex flex-row items-center justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1 border-slate-200 bg-white text-slate-800"
        onClick={requestClose}
      >
        {t(POS_ITEM_CUSTOMIZE_I18N.cancel, "Cancel")}
      </Button>
      <Button type="button" className="h-11 flex-1 text-sm font-semibold" onClick={handleSave}>
        {t(POS_ITEM_CUSTOMIZE_I18N.save, "Save")}
      </Button>
    </div>
  );

  if (isPhone) {
    if (!open) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-slate-100"
        style={keyboardShellStyle}
      >
        <PosSafeAreaTopSpacer />
        {header(
          <h1 className={cn(POS_PANEL.headerTitle, "leading-none")}>{titleText}</h1>,
        )}
        {body}
        <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-3 sm:px-2.5">
          {footerButtons}
        </div>
        <PosSafeAreaBottomSpacer className="bg-white" />
      </div>,
      document.body,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else requestClose();
      }}
    >
      <DialogContent
        hideCloseButton
        className="flex max-h-[min(72dvh,560px)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm sm:max-w-lg"
        aria-describedby={undefined}
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
