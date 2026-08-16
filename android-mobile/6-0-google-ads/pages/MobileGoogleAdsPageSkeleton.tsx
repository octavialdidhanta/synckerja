import React from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { DigitalMarketingMobileFooter } from "@/mobile/6-0-digital-marketing/components/DigitalMarketingMobileFooter";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { SUMMARY_SLOT_COUNT } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";

export default function MobileGoogleAdsPageSkeleton() {
  useStatusBarStyle("light");
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="md:hidden shrink-0" />
              <div className="min-w-0">
                <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto min-w-0 w-full max-w-md space-y-2 px-2 pt-2 content-padding-above-nav-default">
                <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
                  {Array.from({ length: 1 + SUMMARY_SLOT_COUNT }, (_, i) => (
                    <div key={i} className="bg-card px-4 py-3">
                      <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-muted/50" />
                      <div className="h-6 w-24 animate-pulse rounded bg-muted/60" />
                      <div className="mt-0.5 h-3 w-20 animate-pulse rounded bg-muted/40" />
                      <div className="mt-2 h-1.5 w-full animate-pulse rounded bg-muted/40" />
                    </div>
                  ))}
                </div>

                <div className="-mx-2 min-w-0 border-y border-border bg-card">
                  <div className="nested-scroll-touch-chain-xy min-w-0 w-full overflow-x-auto overflow-y-hidden px-2 py-2">
                    <div className="inline-flex w-max items-center gap-2">
                      <div className="h-11 w-28 shrink-0 animate-pulse rounded-md bg-muted/40" />
                      <div className="h-11 w-36 shrink-0 animate-pulse rounded-md bg-muted/40" />
                      <div className="h-11 w-32 shrink-0 animate-pulse rounded-md bg-muted/40" />
                      <div className="h-11 w-24 shrink-0 animate-pulse rounded-md bg-muted/40" />
                      <div className="h-11 w-32 shrink-0 animate-pulse rounded-md bg-muted/40" />
                    </div>
                  </div>
                </div>

                <div className="-mx-2 border-y border-border bg-card p-3 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
                    </div>
                  ))}
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
