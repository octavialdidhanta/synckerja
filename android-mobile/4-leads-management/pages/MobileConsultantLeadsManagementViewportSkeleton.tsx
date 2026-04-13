import { MessageCircle, UserPlus, FileBarChart } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Lead cards — rhythm selaras daftar leads mobile. */
function MobileConsultantLeadsListBodySkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-4 w-[70%]" aria-hidden />
              <Skeleton className="h-3 w-[50%]" aria-hidden />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3.5 w-14" aria-hidden />
            <Skeleton className="h-3.5 w-20" aria-hidden />
            <Skeleton className="h-3.5 w-16" aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}

export type MobileConsultantLeadsChromeSkeletonProps = {
  wrapperClassName?: string;
};

/**
 * Shell mobile daftar leads: header + scroll + strip footer CRM (bukan halaman report).
 */
export function MobileConsultantLeadsChromeSkeleton({
  wrapperClassName,
}: MobileConsultantLeadsChromeSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t("leadsManagement.mobile.loadingAria", "Loading leads");
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
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 max-w-[55%]" aria-hidden />
              <Skeleton className="h-3 max-w-[80%]" aria-hidden />
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Skeleton className="h-9 w-9 rounded-md" aria-hidden />
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
            <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-leads-management">
              <MobileConsultantLeadsListBodySkeleton />
            </div>
          </div>
        </div>

        <nav
          className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower"
          aria-hidden
        >
          <div className="mx-auto grid max-w-md min-h-[52px] grid-cols-3">
            <div className="flex flex-col items-center justify-center py-2 transition-colors text-muted-foreground">
              <MessageCircle className="mb-1 h-5 w-5 shrink-0 opacity-60" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.livechat.title", "Live Chat")}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 transition-colors text-primary">
              <UserPlus className="mb-1 h-5 w-5 shrink-0" aria-hidden />
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

export function MobileConsultantLeadsShellSkeleton() {
  return (
    <div className="relative min-h-[100dvh] w-full bg-background">
      <MobileConsultantLeadsChromeSkeleton />
    </div>
  );
}

export function MobileConsultantLeadsFullViewportOverlay() {
  return (
    <MobileConsultantLeadsChromeSkeleton wrapperClassName="fixed inset-0 z-[200] min-h-[100dvh] bg-background" />
  );
}
