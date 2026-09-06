import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Stack above the printer edit page when both can be open. */
  zClassName?: string;
};

/**
 * Phone overlay sits flush above {@link PosAppFooterBar} (blue Settings bar stays
 * visible). Portaled to `document.body` so the Settings pane `transform` /
 * scroll overflow cannot clip the sheet or double-count safe-area insets.
 */
const PHONE_OVERLAY_BOTTOM =
  "bottom-[calc(3.5rem+max(var(--footer-bottom-inset,0px),var(--safe-area-inset-bottom,0px),env(safe-area-inset-bottom,0px)))]";

/**
 * Printer settings subpages: full screen on phone (no black sheet overlay),
 * dialog on tablet.
 */
export function PosPrinterPageChrome({
  open,
  onOpenChange,
  title,
  children,
  zClassName = "z-[80]",
}: Props) {
  const isPhone = usePosCashierIsPhoneLayout();

  if (isPhone) {
    if (!open) return null;
    return createPortal(
      <div
        className={cn(
          "fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-slate-100",
          PHONE_OVERLAY_BOTTOM,
          zClassName,
        )}
      >
        <PosSafeAreaTopSpacer />
        {children}
      </div>,
      document.body,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "flex h-[min(94dvh,980px)] w-[min(94vw,560px)] max-h-[min(94dvh,980px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm [&>button]:hidden",
          zClassName,
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
