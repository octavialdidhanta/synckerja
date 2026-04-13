import { Outlet, useLocation } from "react-router-dom";
import { AppShellLayout } from "@/shared/layouts/AppShellLayout";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

/** Bottom-nav parity routes render full-screen chrome inside the page (no desktop AppHeader / sidebar). */
const MOBILE_MAIN_TAB_PATHS = new Set([
  "/",
  "/schedule",
  "/client-visit",
  "/reports",
  "/profile",
]);

export function AdaptiveAppLayout() {
  const { isDesktop } = useAuthSurface();
  const { pathname } = useLocation();
  const toolsMobileViewport = useToolsModuleMobileViewport();

  const isMobileExpensesPath = pathname === "/expenses" || pathname.startsWith("/expenses/");
  /** Incomes mobile shell (`android-mobile/3-dashboard`) brings its own header + bottom tabs — same as expenses. */
  const isMobileIncomesPath = pathname === "/incomes" || pathname.startsWith("/incomes/");
  /** Habit tracker mobile (`android-mobile/1-habits`) uses fixed viewport shell + own header/footer — must not sit inside AppShell scroll/header. */
  const isMobileHabitsTrackerPath = pathname === "/tools/habits-tracker";
  /**
   * Daily task / initiative / job desc mobile (`5-daily-task`) membawa `AppSidebar` + header sendiri.
   * Tanpa bypass ini, `AppShellLayout` tetap merender `AppHeader` (PT Synckerja, notifikasi, profil) di atas shell mobile.
   */
  const isMobileDailyTaskToolsPath = pathname === "/tools/daily-task";
  const isMobileDailyTaskReportPath = pathname === "/tools/daily-task-report";
  /** Meeting notes mobile (`5-meeting-notes`) membawa `AppSidebar` + `SidebarTrigger` + footer tools sendiri. */
  const isMobileMeetingNotesPath = pathname === "/tools/meeting-notes";
  /** Consultant livechat mobile (`4-livechat`) membawa `AppSidebar` + `SidebarTrigger` + `NavigationFooter` CRM sendiri. */
  const isMobileConsultantLivechatPath = pathname === "/operations/consultant/all/livechat";
  /** Consultant leads mobile (`4-leads-management`) membawa `AppSidebar` + `SidebarTrigger` + footer CRM sendiri. */
  const isMobileConsultantLeadsManagementPath = pathname === "/operations/consultant/leads-management";
  /** Subscription mobile (`6-subscription`) membawa `AppSidebar` + `SidebarTrigger` + bottom tabs sendiri. */
  const isMobileSubscriptionShellPath =
    pathname === "/subscription/overview" ||
    pathname === "/subscription/plans" ||
    pathname === "/subscription/management";

  if (
    !isDesktop &&
    (MOBILE_MAIN_TAB_PATHS.has(pathname) ||
      isMobileExpensesPath ||
      isMobileIncomesPath ||
      isMobileHabitsTrackerPath)
  ) {
    return <Outlet />;
  }

  if (toolsMobileViewport && isMobileDailyTaskToolsPath) {
    return <Outlet />;
  }

  if (toolsMobileViewport && isMobileDailyTaskReportPath) {
    return <Outlet />;
  }

  if (toolsMobileViewport && isMobileMeetingNotesPath) {
    return <Outlet />;
  }

  if (toolsMobileViewport && isMobileConsultantLivechatPath) {
    return <Outlet />;
  }

  if (toolsMobileViewport && isMobileConsultantLeadsManagementPath) {
    return <Outlet />;
  }

  if (toolsMobileViewport && isMobileSubscriptionShellPath) {
    return <Outlet />;
  }

  /** Habits: `useAuthSurface` memakai breakpoint 768px; layar 769–1023px masih perlu full-bleed jika modul memilih shell mobile. */
  if (toolsMobileViewport && isMobileHabitsTrackerPath) {
    return <Outlet />;
  }

  return <AppShellLayout />;
}
