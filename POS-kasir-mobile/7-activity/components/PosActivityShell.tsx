import type { ReactNode } from "react";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";

type Props = {
  title: string;
  outletLabel: string;
  menuAriaLabel: string;
  onOpenMenu: () => void;
  children: ReactNode;
};

/** Header + split body + footer for Activity. */
export function PosActivityShell({
  title,
  outletLabel,
  menuAriaLabel,
  onOpenMenu,
  children,
}: Props) {
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
      <PosAppFooterBar
        outletLabel={outletLabel}
        onOpenMenu={onOpenMenu}
        menuAriaLabel={menuAriaLabel}
      />
    </div>
  );
}
