import type { ReactNode } from "react";
import { HeaderAndTab } from "@/9-request-form/pages/Purchase/section/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";

/** Single main vertical scroll + card body for all request-form sub-routes. */
export function RequestFormSubPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-muted/30 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="grid min-h-[calc(100dvh-210px)] flex-1 gap-2 px-4 pb-2 pt-0 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex-shrink-0">
            <HeaderAndTab />
          </div>
          <ModuleShellContentGate>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {children}
            </div>
          </ModuleShellContentGate>
        </div>
      </div>
    </div>
  );
}
