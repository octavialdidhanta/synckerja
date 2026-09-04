import type { ReactNode } from "react";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";

type Props = {
  title: string;
  outletLabel: string;
  menuAriaLabel: string;
  onOpenMenu: () => void;
  isPhoneLayout?: boolean;
  children: ReactNode;
};

/**
 * Activity shell — tablet: title header + card; phone: safe-area + full-bleed body,
 * module title in footer (Menu + title), no icon nav / no top title bar.
 */
export function PosActivityShell({
  title,
  outletLabel,
  menuAriaLabel,
  onOpenMenu,
  isPhoneLayout,
  children,
}: Props) {
  const footer = (
    <PosAppFooterBar
      outletLabel={isPhoneLayout ? title : outletLabel}
      onOpenMenu={onOpenMenu}
      menuAriaLabel={menuAriaLabel}
    />
  );

  if (isPhoneLayout) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-white">
        <PosSafeAreaTopSpacer />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {children}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-100">
      <div className="flex min-h-0 flex-1 flex-col p-4 pb-3">
        <header className="mb-3 flex flex-shrink-0 items-center justify-center">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {children}
        </div>
      </div>
      {footer}
    </div>
  );
}
