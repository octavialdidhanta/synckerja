import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
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
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { useCapacitorKeyboardInset } from "@/shared/native/useCapacitorKeyboardInset";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { formatIdIntegerGrouping, stripToDigits } from "../../utils/formatIdUnitPrice";
import { newVariantDraft, type VariantDraft } from "../types";

export type AddProductVariantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: VariantDraft[];
  onConfirm: (variants: VariantDraft[]) => void;
};

const HEIGHT_DROP_PX = 120;
const HEIGHT_DROP_RATIO = 0.15;
/** Comfortable fixed shell when IME is closed (desktop / tablet). */
const DESKTOP_SHELL_MAX_PX = 640;
const DESKTOP_SHELL_VH = 0.72;

function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "file", "hidden", "range", "color"].includes(
      type,
    );
  }
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
}

export function AddProductVariantDialog({
  open,
  onOpenChange,
  variants,
  onConfirm,
}: AddProductVariantDialogProps) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const { keyboardOpenNative } = useCapacitorKeyboardInset();
  const [rows, setRows] = useState<VariantDraft[]>(variants);

  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  const [textFieldFocused, setTextFieldFocused] = useState(false);
  const baselineRef = useRef(typeof window === "undefined" ? 0 : window.innerHeight);

  useEffect(() => {
    if (!open) return;
    setRows(variants.length > 0 ? variants.map((row) => ({ ...row })) : [newVariantDraft()]);
  }, [open, variants]);

  /**
   * Tablet/desktop Dialog: detect IME via Capacitor or adjustResize height drop.
   * When open, dock the shell to the visible viewport so footer + focused row stay usable.
   */
  useEffect(() => {
    if (!open || isPhone || typeof window === "undefined") return;

    const syncHeight = () => {
      const h = window.innerHeight;
      setViewportH(h);
      if (!isTextField(document.activeElement)) {
        baselineRef.current = h;
      }
    };

    const syncFocus = () => {
      requestAnimationFrame(() => {
        const focused = isTextField(document.activeElement);
        setTextFieldFocused(focused);
        if (!focused) {
          baselineRef.current = window.innerHeight;
          setViewportH(window.innerHeight);
          return;
        }
        const el = document.activeElement;
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    };

    syncHeight();
    syncFocus();
    window.addEventListener("resize", syncHeight);
    window.visualViewport?.addEventListener("resize", syncHeight);
    document.addEventListener("focusin", syncFocus);
    document.addEventListener("focusout", syncFocus);
    return () => {
      window.removeEventListener("resize", syncHeight);
      window.visualViewport?.removeEventListener("resize", syncHeight);
      document.removeEventListener("focusin", syncFocus);
      document.removeEventListener("focusout", syncFocus);
    };
  }, [open, isPhone]);

  const baseline = baselineRef.current || viewportH;
  const heightDrop = Math.max(0, baseline - viewportH);
  const heightCompressed =
    textFieldFocused &&
    baseline > 0 &&
    (heightDrop >= HEIGHT_DROP_PX || heightDrop / baseline >= HEIGHT_DROP_RATIO);

  const keyboardDocked = !isPhone && open && (keyboardOpenNative || heightCompressed);

  const desktopShellMetrics = useMemo(() => {
    const closedH = Math.min(
      DESKTOP_SHELL_MAX_PX,
      typeof window !== "undefined"
        ? Math.round(window.innerHeight * DESKTOP_SHELL_VH)
        : DESKTOP_SHELL_MAX_PX,
    );
    if (!keyboardDocked || viewportH <= 0) {
      return { height: closedH, topPad: 0, docked: false as const };
    }
    const topPad = Math.max(12, Math.round(viewportH * 0.02));
    const height = Math.max(280, Math.min(DESKTOP_SHELL_MAX_PX, viewportH - topPad * 2));
    return { height, topPad, docked: true as const };
  }, [keyboardDocked, viewportH]);

  const desktopShellStyle: CSSProperties | undefined = desktopShellMetrics.docked
    ? {
        top: desktopShellMetrics.topPad,
        left: "50%",
        transform: "translateX(-50%)",
        height: desktopShellMetrics.height,
        maxHeight: desktopShellMetrics.height,
        bottom: "auto",
        width: "min(32rem, calc(100vw - 2rem))",
      }
    : undefined;

  const handleConfirm = () => {
    const next = rows.filter((row) => row.name.trim());
    if (next.length === 0) return;
    onConfirm(next);
    onOpenChange(false);
  };

  const canConfirm = rows.some((row) => row.name.trim());
  const titleText = t("defaultPrices.product.variant.addTitle", "Add Variant");

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
        <p className={cn(POS_PANEL.sectionTitle, "first:pt-0")}>
          {t("defaultPrices.product.variant.listSection", "Variants")}
        </p>

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className={POS_PANEL.card}>
              <div className={POS_PANEL.formRow}>
                <Input
                  value={row.name}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, name: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t("defaultPrices.product.variant.name", "Variant Name")}
                  className={POS_PANEL.formInput}
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                  aria-label={t("common.delete", "Delete")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className={POS_PANEL.formRow}>
                <span className={POS_PANEL.rowLabel}>
                  {t("defaultPrices.product.variant.price", "Price")}
                </span>
                <div className="relative min-w-0 max-w-[55%] flex-1">
                  <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                    Rp
                  </span>
                  <Input
                    value={row.priceDisplay}
                    onChange={(e) => {
                      const digits = stripToDigits(e.target.value);
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? {
                                ...item,
                                priceDisplay: digits ? formatIdIntegerGrouping(digits) : "",
                              }
                            : item,
                        ),
                      );
                    }}
                    placeholder="0"
                    className={cn(POS_PANEL.formInput, "pl-9 text-right")}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className={POS_PANEL.formRow}>
                <span className={POS_PANEL.rowLabel}>
                  {t("defaultPrices.product.sku", "SKU")}
                </span>
                <Input
                  value={row.sku}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, sku: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t("defaultPrices.product.sku", "SKU")}
                  className={POS_PANEL.formInputEnd}
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full border-slate-200 bg-white text-sm font-semibold text-slate-800"
          onClick={() => setRows((prev) => [...prev, newVariantDraft()])}
        >
          {t("defaultPrices.product.variant.addTitle", "Add Variant")}
        </Button>
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
        onClick={handleConfirm}
        disabled={!canConfirm}
      >
        {t("defaultPrices.product.inventory.confirm", "Confirm")}
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
        style={desktopShellStyle}
        className={cn(
          "flex w-full max-w-lg flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm sm:max-w-lg",
          desktopShellMetrics.docked
            ? "translate-x-[-50%] translate-y-0"
            : "h-[min(72dvh,640px)] max-h-[min(72dvh,640px)]",
        )}
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
