import type { ReactNode } from "react";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { usePosKeyboardShellStyle } from "@/pos-mobile/shared/hooks/usePosKeyboardShellStyle";

type Props = {
  title: string;
  outletLabel: string;
  menuAriaLabel: string;
  onOpenMenu: () => void;
  isPhoneLayout?: boolean;
  /** Replaces center label (e.g. Send + Refund on detail). */
  footerCenter?: ReactNode;
  children: ReactNode;
};

/**
 * Activity shell — canvas slate-100, compact card chrome (standard POS panel style).
 * Phone: safe-area + full-bleed; footer Menu + title or custom center actions.
 */
export function PosActivityShell({
  title,
  outletLabel,
  menuAriaLabel,
  onOpenMenu,
  isPhoneLayout,
  footerCenter,
  children,
}: Props) {
  const keyboardShellStyle = usePosKeyboardShellStyle();
  const footer = (
    <PosAppFooterBar
      outletLabel={isPhoneLayout ? title : outletLabel}
      center={footerCenter}
      onOpenMenu={onOpenMenu}
      menuAriaLabel={menuAriaLabel}
    />
  );

  if (isPhoneLayout) {
    return (
      <div
        className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100"
        style={keyboardShellStyle}
      >
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
          {children}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100"
      style={keyboardShellStyle}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-3 pb-3 sm:px-2.5">
        <header className="flex flex-shrink-0 items-center px-0.5">
          <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
          {children}
        </div>
      </div>
      {footer}
    </div>
  );
}
