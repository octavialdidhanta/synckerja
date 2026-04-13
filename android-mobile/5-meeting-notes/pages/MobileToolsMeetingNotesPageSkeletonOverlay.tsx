import { Skeleton } from "@/shared/components/ui/skeleton";
import { ToolsNavigationFooter } from "@/mobile-app/components/ToolsNavigationFooter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
const SCROLL_CHAIN =
  "scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Skeleton overlay mobile untuk `/tools/meeting-notes`.
 * Meniru shell `MeetingNotesPage` + blok filter/input/tabel/summary + footer tools (tab Notes aktif).
 */
export function MobileToolsMeetingNotesPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("meetingNotes.page.loadingAria", "Loading meeting notes");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex min-h-screen w-full min-w-0 flex-col bg-background"
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full max-w-none min-w-0 flex-col bg-background"
        style={mainFixedStyle}
      >
        <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card p-3 safe-area-top">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 max-w-[180px]" aria-hidden />
              <Skeleton className="h-3 max-w-[min(100%,260px)]" aria-hidden />
            </div>
          </div>
          <div />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN}>
            <div className="mx-auto w-full max-w-md shrink-0 space-y-1 px-2 pt-2 content-padding-above-nav-meeting-notes">
              <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex flex-wrap gap-2 border-b border-border px-2.5 py-1.5">
                  <Skeleton className="h-9 min-w-[100px] flex-1 rounded-md" aria-hidden />
                  <Skeleton className="h-9 w-24 rounded-md" aria-hidden />
                  <Skeleton className="h-9 w-24 rounded-md" aria-hidden />
                </div>
                <div className="border-b border-border px-2.5 py-1.5">
                  <Skeleton className="h-10 w-full rounded-md" aria-hidden />
                </div>
                <div className="space-y-2 px-2 py-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" aria-hidden />
                  ))}
                </div>
                <div className="border-t border-border px-2 py-2">
                  <Skeleton className="h-6 w-32" aria-hidden />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card shadow-sm">
                <div className="grid grid-cols-2 gap-2 px-2.5 py-2.5">
                  <Skeleton className="h-16 rounded-lg" aria-hidden />
                  <Skeleton className="h-16 rounded-lg" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
}
