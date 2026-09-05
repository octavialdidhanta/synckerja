import type { ReactNode } from "react";
import { OperationsDashboardHeaderAndTab } from "./OperationsDashboardHeaderAndTab";

type Props = {
  children: ReactNode;
  ariaLabel?: string;
};

export function OperationsDashboardPageSkeletonFrame({ children, ariaLabel }: Props) {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={ariaLabel}
    >
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 flex-shrink-0">
                <OperationsDashboardHeaderAndTab />
              </div>
              {children}
              <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
