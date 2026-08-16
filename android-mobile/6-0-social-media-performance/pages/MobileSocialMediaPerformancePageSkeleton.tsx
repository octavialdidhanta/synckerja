import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { SocialMediaPerformanceMobileFooter } from "@/mobile/6-0-social-media-performance/components/SocialMediaPerformanceMobileFooter";

export default function MobileSocialMediaPerformancePageSkeleton() {
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
                <div className="h-4 w-44 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-2 px-2 pt-2 pb-1">
                <div className="-mx-2 min-w-0 shrink-0 border-y border-border bg-card">
                  <div className="nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-x-auto overflow-y-hidden px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="inline-flex w-max items-center gap-2">
                      <div className="h-11 w-28 shrink-0 animate-pulse rounded-md bg-muted/40" />
                      <div className="h-11 w-36 shrink-0 animate-pulse rounded-md bg-muted/40" />
                    </div>
                  </div>
                </div>

                <div className="-mx-2 grid shrink-0 grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="bg-card px-4 py-3">
                      <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-muted/50" />
                      <div className="h-6 w-24 animate-pulse rounded bg-muted/60" />
                    </div>
                  ))}
                </div>

                <div className="-mx-2 flex min-w-0 shrink-0 flex-col overflow-hidden border-y border-border bg-card">
                  <div className="h-[22.5rem] min-h-[22.5rem] max-h-[22.5rem] overflow-hidden p-3">
                    <div className="mb-3 flex gap-3">
                      <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                      <div className="h-3 w-14 animate-pulse rounded bg-muted/40" />
                      <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
                      <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
                      <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
                    </div>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 py-2">
                        <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
                        <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
                        <div className="h-3 w-10 animate-pulse rounded bg-muted/40" />
                        <div className="h-3 w-10 animate-pulse rounded bg-muted/50" />
                        <div className="h-3 w-14 animate-pulse rounded bg-muted/40" />
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0 border-t border-border bg-muted/50 px-3 py-2">
                    <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
                  </div>
                </div>
            </div>
            </div>
          </div>

          {!isKeyboardShellOpen ? (
            <SocialMediaPerformanceMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>
    </SidebarProvider>
  );
}
