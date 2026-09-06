import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";

type Props = {
  leftHeader: string;
  rightHeader: string;
  /** When true, omit the right pane title bar (sub-views with their own header). */
  hideRightHeader?: boolean;
  left: ReactNode;
  /** Optional sticky slot under left scroll. */
  leftFooter?: ReactNode;
  right: ReactNode;
  footer: ReactNode;
  className?: string;
  /** Right pane canvas; default slate-100 for card-on-surface depth. */
  rightPaneClassName?: string;
};

/**
 * Master–detail settings shell — standard POS panel chrome (slate-100 + white cards).
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
  rightPaneClassName = "bg-slate-100",
}: Props) {
  return (
    <div className={cn("relative flex h-screen flex-col bg-slate-100", className)}>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[42%] min-w-[320px] max-w-[420px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className={POS_PANEL.header}>
            <h1 className={cn(POS_PANEL.headerTitle, "px-1")}>{leftHeader}</h1>
          </div>
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {left}
          </div>
          {leftFooter ? (
            <div className="flex-shrink-0 border-t border-slate-200 bg-white px-2 py-2.5 sm:px-2.5">
              {leftFooter}
            </div>
          ) : null}
        </aside>

        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            rightPaneClassName,
          )}
        >
          {hideRightHeader ? null : (
            <div className={cn(POS_PANEL.header, "bg-white")}>
              <h2 className={cn(POS_PANEL.headerTitle, "px-1")}>{rightHeader}</h2>
            </div>
          )}
          <div
            className={cn(
              "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              rightPaneClassName,
            )}
          >
            {right}
          </div>
        </section>
      </div>
      {footer}
    </div>
  );
}
