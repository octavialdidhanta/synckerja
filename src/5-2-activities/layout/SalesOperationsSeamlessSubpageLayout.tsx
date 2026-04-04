import type { ReactNode } from "react";
import { HeaderAndTab } from "./HeaderAndTab";

/**
 * Seamless Page Scroll Layout for sales sub-routes under AppShellLayout
 * (`.cursor/rules/Seamless Page Scroll Layout.mdc` — header-ikut-scroll variant).
 */
export function SalesOperationsSeamlessSubpageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full w-full min-w-0 max-w-full flex-col">
              <div className="mb-1 w-full min-w-0 max-w-full shrink-0">
                <HeaderAndTab />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full max-w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col">{children}</div>
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
