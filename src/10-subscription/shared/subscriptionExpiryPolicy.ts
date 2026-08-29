import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";
import type { SubscriptionExpiryStatus } from "@/10-subscription/hooks/useSubscriptionExpiry";
import { deriveSubscriptionDaysRemaining } from "@/10-subscription/shared/subscriptionUtils";

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
  "/verify-operational-email",
  "/create-organization",
  "/organization-unavailable",
  "/create-plan",
  "/subscription/plans",
  "/subscription/management",
] as const;

const SALES_BLOCKED_EXPIRED_ROUTES = [
  "/subscription/plans",
  "/subscription/management",
] as const;

export function isAllowedWhenExpired(
  pathname: string,
  options?: { subscriptionSelfServiceEnabled?: boolean },
): boolean {
  const selfServiceEnabled = options?.subscriptionSelfServiceEnabled !== false;

  return ALLOWED_EXPIRED_ROUTES.some((route) => {
    if (!selfServiceEnabled && SALES_BLOCKED_EXPIRED_ROUTES.includes(route as (typeof SALES_BLOCKED_EXPIRED_ROUTES)[number])) {
      return false;
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  });
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
  const daysLeft = deriveSubscriptionDaysRemaining(subscriptionStatus);
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
  if (pathname === "/digital-marketing/google-ads") return true;
  if (pathname === "/digital-marketing/meta-ads") return true;
  if (pathname === "/digital-marketing/tiktok-ads") return true;
  if (pathname === "/digital-marketing/report") return true;
  if (pathname === "/digital-marketing/social-media/content-calendar") return true;
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
  const isMobileGoogleAdsPath = pathname === "/digital-marketing/google-ads";
  const isMobileMetaAdsPath = pathname === "/digital-marketing/meta-ads";
  const isMobileTikTokAdsPath = pathname === "/digital-marketing/tiktok-ads";
  const isMobileReportPath = pathname === "/digital-marketing/report";
  const isMobileContentCalendarPath =
    pathname === "/digital-marketing/social-media/content-calendar";
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
    isMobileGoogleAdsPath ||
    isMobileMetaAdsPath ||
    isMobileTikTokAdsPath ||
    isMobileReportPath ||
    isMobileContentCalendarPath ||
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
