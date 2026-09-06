import React from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { DigitalMarketingMobileFooter } from "@/mobile/6-0-digital-marketing/components/DigitalMarketingMobileFooter";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { REPORT_SUMMARY_MOBILE_SLOT_COUNT } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

export default function MobileDigitalMarketingReportPageSkeleton() {
  useStatusBarStyle("light");
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center border-b border-border bg-card p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="md:hidden shrink-0" />
              <div className="min-w-0">
                <div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="content-padding-above-nav-default mx-auto w-full max-w-md space-y-2 px-2 pt-2">
                <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
                  {Array.from({ length: REPORT_SUMMARY_MOBILE_SLOT_COUNT }, (_, i) => (
                    <div key={i} className="bg-card px-4 py-3">
                      <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-muted/50" />
                      <div className="h-6 w-24 animate-pulse rounded bg-muted/60" />
                      <div className="mt-0.5 h-3 w-20 animate-pulse rounded bg-muted/40" />
                      <div className="mt-2 h-1.5 w-full animate-pulse rounded bg-muted/40" />
                    </div>
                  ))}
                </div>

                <div className="-mx-2 border-y border-border bg-card px-2 py-2">
                  <div className="flex gap-2 overflow-hidden">
                    <div className="h-11 w-36 shrink-0 animate-pulse rounded-md bg-muted/40" />
                    <div className="h-11 w-32 shrink-0 animate-pulse rounded-md bg-muted/40" />
                    <div className="h-11 w-20 shrink-0 animate-pulse rounded-md bg-muted/40" />
                  </div>
                </div>

                <div className="-mx-2 space-y-2 border-y border-border bg-card p-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
                    </div>
                  ))}
                </div>

                <div className="-mx-2 space-y-2 border-y border-border bg-card p-3">
                  <div className="mb-2 flex gap-2 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-8 w-20 shrink-0 animate-pulse rounded-md bg-muted/40"
                      />
                    ))}
                  </div>
                  <div className="h-40 w-full animate-pulse rounded-md bg-muted/30" />
                </div>
              </div>
            </div>
          </div>

          {!isKeyboardShellOpen ? (
            <DigitalMarketingMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>
    </SidebarProvider>
  );
}
