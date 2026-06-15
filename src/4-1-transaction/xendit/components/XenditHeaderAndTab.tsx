import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { History, Landmark, Lock, Wallet } from "lucide-react";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import {
  XENDIT_BALANCE_PATH,
  XENDIT_BASE_PATH,
  XENDIT_CONNECT_PATH,
  XENDIT_HISTORY_PATH,
} from "@/xendit/lib/xenditPaths";

const tabs = [
  {
    id: "connect" as const,
    path: XENDIT_CONNECT_PATH,
    titleKey: "xendit.tabs.connect",
    fallbackTitle: "Connect account",
    icon: Landmark,
  },
  {
    id: "balance" as const,
    path: XENDIT_BALANCE_PATH,
    titleKey: "xendit.tabs.balance",
    fallbackTitle: "Balance & Withdrawals",
    icon: Wallet,
  },
  {
    id: "history" as const,
    path: XENDIT_HISTORY_PATH,
    titleKey: "xendit.tabs.history",
    fallbackTitle: "Withdrawal history",
    icon: History,
  },
];

export function XenditHeaderAndTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();

  const activeId = useMemo(() => {
    if (location.pathname.startsWith(XENDIT_HISTORY_PATH)) return "history";
    if (location.pathname.startsWith(XENDIT_BALANCE_PATH)) return "balance";
    if (location.pathname.startsWith(XENDIT_CONNECT_PATH)) return "connect";
    if (location.pathname === XENDIT_BASE_PATH) return "connect";
    return "connect";
  }, [location.pathname]);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t("xendit.header.title", "Xendit")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t(
            "xendit.header.subtitle",
            "Connect xenPlatform, manage balance, and withdraw to your payout bank",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav
          className="flex flex-wrap gap-x-6 gap-y-1"
          aria-label={t("xendit.header.nav", "Xendit navigation")}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeId === tab.id;
            const locked = isTabLocked(XENDIT_BASE_PATH);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                onMouseEnter={() => prefetchAppRoute(tab.path)}
                onFocus={() => prefetchAppRoute(tab.path)}
                title={
                  locked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : undefined
                }
                className={`flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
                  locked
                    ? "border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{label}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

XenditHeaderAndTab.displayName = "XenditHeaderAndTab";
