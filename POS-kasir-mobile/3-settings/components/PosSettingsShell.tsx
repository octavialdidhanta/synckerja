import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type Props = {
  leftHeader: string;
  rightHeader: string;
  /** When true, omit the right pane title bar (sub-views with their own header). */
  hideRightHeader?: boolean;
  left: ReactNode;
  /** Optional sticky slot under left scroll (e.g. coral KELUAR). */
  leftFooter?: ReactNode;
  right: ReactNode;
  footer: ReactNode;
  className?: string;
};

/**
 * Master–detail settings shell: split headers, two panes, footer slot.
 */
export function PosSettingsShell({
  leftHeader,
  rightHeader,
  hideRightHeader,
  left,
  leftFooter,
  right,
  footer,
  className,
}: Props) {
  return (
    <div className={cn("relative flex h-screen flex-col bg-white", className)}>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[42%] min-w-[320px] max-w-[420px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex h-12 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-4">
            <h1 className="text-base font-semibold text-slate-900">{leftHeader}</h1>
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {left}
          </div>
          {leftFooter ? (
            <div className="flex-shrink-0 border-t border-slate-200 bg-white p-3">
              {leftFooter}
            </div>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          {hideRightHeader ? null : (
            <div className="flex h-12 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-4">
              <h2 className="text-base font-semibold text-slate-900">{rightHeader}</h2>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{right}</div>
        </section>
      </div>
      {footer}
    </div>
  );
}
