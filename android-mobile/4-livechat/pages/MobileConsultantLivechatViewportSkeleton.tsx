import { MessageCircle, UserPlus, FileBarChart } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Scroll body: conversation rows — mirrors list rhythm under `content-padding-above-nav-livechat`. */
function MobileConsultantLivechatBodySkeleton() {
  return (
    <div className="p-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border p-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-32 max-w-[70%]" aria-hidden />
            <Skeleton className="h-3 w-48 max-w-[90%]" aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}

export type MobileConsultantLivechatChromeSkeletonProps = {
  wrapperClassName?: string;
};

/**
 * Mobile livechat list chrome (no sidebar): neutral header bar + filters + list + bottom bar.
 * Skeleton blocks use default `Skeleton` styling (muted) — no primary-tinted placeholder colors.
 */
export function MobileConsultantLivechatChromeSkeleton({
  wrapperClassName,
}: MobileConsultantLivechatChromeSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t("livechat.page.loadingAria", "Loading live chat");
  const { mainFixedStyle } = useVisualViewport();

  const inner = (
    <>
      <span className="sr-only">{aria}</span>
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full flex-col bg-background"
        style={mainFixedStyle}
        aria-busy="true"
        aria-label={aria}
      >
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 flex-col gap-2 border-b border-primary/20 bg-primary px-2 pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 max-w-[60%]" aria-hidden />
              <Skeleton className="h-3 max-w-[85%]" aria-hidden />
            </div>
          </div>
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <Skeleton className="h-8 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-8 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" aria-hidden />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              "seamless-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto",
              SCROLL_HIDE,
            )}
          >
            <div className="h-0 shrink-0" aria-hidden />
            <div className="content-padding-above-nav-livechat flex min-h-0 flex-col">
              <MobileConsultantLivechatBodySkeleton />
            </div>
          </div>
        </div>

        <nav
          className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower"
          aria-hidden
        >
          <div className="mx-auto grid max-w-md min-h-[52px] grid-cols-3">
            <div className="flex flex-col items-center justify-center py-2 transition-colors text-primary">
              <MessageCircle className="mb-1 h-5 w-5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.livechat.title", "Live Chat")}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 transition-colors text-muted-foreground">
              <UserPlus className="mb-1 h-5 w-5 shrink-0 opacity-60" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.leadsManagement.title", "Leads")}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 transition-colors text-muted-foreground">
              <FileBarChart className="mb-1 h-5 w-5 shrink-0 opacity-60" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.leadsManagement.report", "Report")}
              </span>
            </div>
          </div>
        </nav>
      </main>
    </>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{inner}</div>;
  }
  return inner;
}

/** Guard / initial route: full viewport chrome without sidebar. */
export function MobileConsultantLivechatShellSkeleton() {
  return (
    <div className="relative min-h-[100dvh] w-full bg-background">
      <MobileConsultantLivechatChromeSkeleton />
    </div>
  );
}

/** Data overlay until conversations + filters settle. */
export function MobileConsultantLivechatFullViewportOverlay() {
  return (
    <MobileConsultantLivechatChromeSkeleton wrapperClassName="fixed inset-0 z-[200] min-h-[100dvh] bg-background" />
  );
}
