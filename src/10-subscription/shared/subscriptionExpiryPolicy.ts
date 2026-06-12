import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";
import type { SubscriptionExpiryStatus } from "@/10-subscription/hooks/useSubscriptionExpiry";

/** Show global warning banner when days until expiry is at or below this threshold. */
export const BANNER_DAYS_THRESHOLD = 3;

/** Routes still reachable when subscription is expired (renewal flows). */
export const ALLOWED_EXPIRED_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/verify-email",
  "/email-verified",
  "/create-organization",
  "/create-plan",
  "/subscription/plans",
  "/subscription/management",
] as const;

export function isAllowedWhenExpired(pathname: string): boolean {
  return ALLOWED_EXPIRED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function canManageSubscriptionRole(role: string | undefined): boolean {
  const normalized = (role || "").toLowerCase();
  return normalized === "owner" || normalized === "admin";
}

export function shouldShowExpiryBanner(
  subscriptionStatus: SubscriptionStatus | null | undefined,
  expiryStatus: SubscriptionExpiryStatus,
): boolean {
  if (!subscriptionStatus) return false;
  if (expiryStatus.isExpired) return false;
  const daysLeft = subscriptionStatus.days_until_expiry ?? Number.POSITIVE_INFINITY;
  return daysLeft <= BANNER_DAYS_THRESHOLD;
}

/** Bottom-nav parity routes render full-screen chrome inside the page (no desktop AppHeader). */
const MOBILE_MAIN_TAB_PATHS = new Set([
  "/",
  "/schedule",
  "/client-visit",
  "/reports",
  "/profile",
]);

export function usesInlineSubscriptionBannerSlot(pathname: string): boolean {
  if (pathname === "/") return true;
  if (MOBILE_MAIN_TAB_PATHS.has(pathname)) return true;
  if (pathname === "/expenses" || pathname.startsWith("/expenses/")) return true;
  if (pathname === "/incomes" || pathname.startsWith("/incomes/")) return true;
  if (pathname === "/digital-marketing/traffic") return true;
  if (pathname === "/tools/habits-tracker") return true;
  if (
    pathname === "/tools/daily-task" ||
    pathname === "/tools/daily-task-report" ||
    pathname === "/tools/meeting-notes"
  ) {
    return true;
  }
  if (pathname === "/omnichannel/livechat" || pathname.startsWith("/omnichannel/livechat/")) {
    return true;
  }
  if (pathname === "/omnichannel/leads" || pathname.startsWith("/omnichannel/leads/")) {
    return true;
  }
  if (
    pathname === "/subscription/overview" ||
    pathname === "/subscription/plans" ||
    pathname === "/subscription/management"
  ) {
    return true;
  }
  return false;
}

export function isMobileBypassRoute(
  pathname: string,
  options: {
    isDesktop: boolean;
    toolsMobileViewport: boolean;
    shareReceiptValidationPath: string;
  },
): boolean {
  if (options.isDesktop) return false;

  const isMobileExpensesPath = pathname === "/expenses" || pathname.startsWith("/expenses/");
  const isMobileIncomesPath = pathname === "/incomes" || pathname.startsWith("/incomes/");
  const isMobileHabitsTrackerPath = pathname === "/tools/habits-tracker";
  const isMobileWebTrafficPath = pathname === "/digital-marketing/traffic";
  const isMobileDailyTaskToolsPath = pathname === "/tools/daily-task";
  const isMobileDailyTaskReportPath = pathname === "/tools/daily-task-report";
  const isMobileMeetingNotesPath = pathname === "/tools/meeting-notes";
  const isMobileConsultantLivechatPath =
    pathname === "/omnichannel/livechat" || pathname.startsWith("/omnichannel/livechat/");
  const isMobileConsultantLeadsManagementPath =
    pathname === "/omnichannel/leads" || pathname.startsWith("/omnichannel/leads/");
  const isMobileSubscriptionShellPath =
    pathname === "/subscription/overview" ||
    pathname === "/subscription/plans" ||
    pathname === "/subscription/management";
  const isMobileShareReceiptValidationPath = pathname === options.shareReceiptValidationPath;

  if (
    MOBILE_MAIN_TAB_PATHS.has(pathname) ||
    isMobileExpensesPath ||
    isMobileIncomesPath ||
    isMobileHabitsTrackerPath ||
    isMobileWebTrafficPath ||
    isMobileShareReceiptValidationPath
  ) {
    return true;
  }

  if (!options.toolsMobileViewport) return false;

  return (
    isMobileDailyTaskToolsPath ||
    isMobileDailyTaskReportPath ||
    isMobileMeetingNotesPath ||
    isMobileConsultantLivechatPath ||
    isMobileConsultantLeadsManagementPath ||
    isMobileSubscriptionShellPath ||
    isMobileHabitsTrackerPath
  );
}
