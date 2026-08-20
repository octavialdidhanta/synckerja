import type { ReactNode } from "react";
import { SettingsItemNav } from "../components/SettingsItemNav";

export function SettingsWorkspace({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
            <SettingsItemNav />
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </>
  );
}
