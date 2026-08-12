import React from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { SocialMediaMobileFooter } from "@/mobile/6-1-content-calendar/components/SocialMediaMobileFooter";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";

export default function MobileContentCalendarPageSkeleton() {
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
                <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-1 content-padding-above-nav-default">
                <div className="mx-auto h-7 w-36 animate-pulse rounded bg-muted/40" />

                <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="bg-card px-3 py-3">
                      <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-muted/50" />
                      <div className="h-6 w-10 animate-pulse rounded bg-muted/60" />
                      <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-muted/40" />
                    </div>
                  ))}
                </div>

                <div className="-mx-2 border-y border-border bg-card p-2">
                  <div className="mb-2 flex gap-1">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-8 flex-1 animate-pulse rounded-md bg-muted/40" />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="min-h-[100px] animate-pulse rounded-md border border-border bg-muted/30"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isKeyboardShellOpen ? (
            <SocialMediaMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>
    </SidebarProvider>
  );
}
