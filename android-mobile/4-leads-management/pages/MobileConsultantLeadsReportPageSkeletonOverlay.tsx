import { Clock, FileBarChart, MessageCircle, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";
import {
  MOBILE_LEADS_REPORT_CONTENT_CLASS,
  MOBILE_LEADS_REPORT_HEADER_CLASS,
} from "../report/mobileLeadsReportLayout";

/** mobile-tools-layout-android.mdc §1: scroll = flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col (+ scrollbar-hide) */
const SCROLL_CHAIN =
  "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll scrollbar-hide nested-scroll-touch-chain touch-pan-y overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Mirror struktur `LeadsManagementPage` → `main` + `LeadsReportSummaryView` (mobile) + `ConsultantCrmNavigationFooter` (3–4 kolom).
 * Dipakai portal full-screen saat report summary masih memuat.
 */
function LeadsReportInsightsSkeletonBody() {
  const sectionCard = (gradient: string) =>
    cn(
      "border border-border bg-gradient-to-r shadow-none",
      gradient,
    );

  return (
    <div className="min-w-0 max-w-full space-y-1">
      <Skeleton className="h-10 w-full rounded-md" aria-hidden />
      <div className="mt-1 space-y-1">
      <Card className={sectionCard("from-emerald-50 to-green-50")}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" aria-hidden />
            <Skeleton className="h-4 w-40" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20 w-full rounded-lg bg-white/70" aria-hidden />
            <Skeleton className="h-20 w-full rounded-lg bg-white/70" aria-hidden />
          </div>
          <Skeleton className="h-24 w-full rounded-lg bg-white/70" aria-hidden />
        </CardContent>
      </Card>

      <Card className={sectionCard("from-slate-50 to-gray-50")}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" aria-hidden />
            <Skeleton className="h-4 w-16" aria-hidden />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full rounded-lg bg-white/70" aria-hidden />
        </CardContent>
      </Card>

      <Card className={sectionCard("from-blue-50 to-indigo-50")}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" aria-hidden />
            <Skeleton className="h-4 w-28" aria-hidden />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 w-full rounded-lg bg-white/70" aria-hidden />
            <Skeleton className="h-20 w-full rounded-lg bg-white/70" aria-hidden />
            <Skeleton className="h-20 w-full rounded-lg bg-white/70" aria-hidden />
          </div>
        </CardContent>
      </Card>

      <Card className={sectionCard("from-purple-50 to-pink-50")}>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-32" aria-hidden />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md bg-white/70" aria-hidden />
          ))}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export function MobileConsultantLeadsReportPageSkeletonOverlay() {
  const { t } = useAppTranslation();
  const { mainFixedStyle } = useVisualViewport();
  const aria = t("leadsManagement.report.mobile.loadingAria", "Loading report summary");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex min-h-screen w-full min-w-0 flex-col bg-background"
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 flex-col bg-background"
        style={mainFixedStyle}
      >
        <header className={MOBILE_LEADS_REPORT_HEADER_CLASS}>
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" aria-hidden />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 max-w-[220px]" aria-hidden />
              <Skeleton className="h-3 max-w-[280px]" aria-hidden />
            </div>
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className={SCROLL_CHAIN} style={{ overscrollBehavior: "contain" }}>
            <div className="h-0 shrink-0 bg-background" aria-hidden />
            <div className={MOBILE_LEADS_REPORT_CONTENT_CLASS}>
              <LeadsReportInsightsSkeletonBody />
            </div>
          </div>
        </div>

        <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower">
          <div className={cn("mx-auto grid max-w-md min-h-[52px] grid-cols-4")}>
            <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
              <MessageCircle className="mb-1 h-5 w-5 shrink-0 opacity-60" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.livechat.title", "Live Chat")}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
              <Clock className="mb-1 h-5 w-5 shrink-0 opacity-60" aria-hidden />
              <span className="text-xs font-medium">
                {t("leadsManagement.footer.idleAgents", "Idle Agents")}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
              <UserPlus className="mb-1 h-5 w-5 shrink-0 opacity-60" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.leadsManagement.title", "Leads")}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2 text-primary">
              <FileBarChart className="mb-1 h-5 w-5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">
                {t("sidebar.operations.leadsManagement.report", "Report")}
              </span>
            </div>
          </div>
        </nav>
      </main>
    </div>
  );
}
