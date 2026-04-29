import React from "react";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { WebTrafficNavigationFooter } from "@/mobile/6-0-web-traffic/components/WebTrafficNavigationFooter";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";

export default function MobileWebTrafficPageSkeleton() {
  useStatusBarStyle("light");
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="min-w-0">
              <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
              <div className="mt-1 h-3 w-56 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
          <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-default">
              <div className="rounded-lg border border-primary/35 bg-card p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                <div className="mt-2 h-6 w-32 animate-pulse rounded bg-muted/60" />
              </div>
              <div className="rounded-lg border border-primary/35 bg-card p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                <div className="mt-2 h-8 w-52 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="rounded-lg border border-primary/35 bg-card p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                <div className="mt-2 h-6 w-40 animate-pulse rounded bg-muted/60" />
              </div>
              <div className="rounded-lg border border-primary/35 bg-card p-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                <div className="mt-2 h-6 w-28 animate-pulse rounded bg-muted/60" />
              </div>

              <div className="rounded-lg border border-primary/35 bg-card p-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="h-3 w-44 animate-pulse rounded bg-muted/40" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isKeyboardShellOpen ? (
          <WebTrafficNavigationFooter className="safe-area-bottom-lower" />
        ) : null}
        </main>
      </div>
    </SidebarProvider>
  );
}

