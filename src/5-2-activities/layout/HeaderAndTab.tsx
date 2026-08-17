import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, Calendar, Users, Store, Lock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const tabs = [
  {
    key: "activities",
    path: "/operations/sales/activities",
    title: "Activities",
    icon: Activity,
  },
  {
    key: "jadwal-kunjungan",
    path: "/operations/sales/jadwal-kunjungan",
    title: "Jadwal Kunjungan",
    icon: Calendar,
  },
  {
    key: "client-visits",
    path: "/operations/sales/client-visits",
    title: "Sales Visits",
    icon: Users,
  },
  {
    key: "customer-visits",
    path: "/operations/sales/customer-visits",
    title: "Customer Visits",
    icon: Store,
  },
];

export const HeaderAndTab = () => {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = useMemo(() => {
    const match = tabs.find((tab) => location.pathname.startsWith(tab.path));
    return match?.key ?? "activities";
  }, [location.pathname]);

  return (
    <div className="px-1 py-3">
      {/* Header Section */}
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">Sales Operations</h1>
        <p className="text-xs text-gray-600">Manage sales activities and client interactions</p>
      </div>

      {/* Tabs Section */}
      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;
            const locked = isTabLocked(tab.path);

            const title =
              tab.key === "customer-visits"
                ? t("customerVisits.tabTitle", "Customer Visits")
                : tab.title;

            return (
              <div
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => navigate(tab.path)}
                title={
                  locked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : undefined
                }
                className={cn(
                  "group flex cursor-pointer items-center gap-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
                  locked
                    ? "border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-muted-foreground hover:border-surface-border hover:text-foreground",
                )}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-brand-blue" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    isActive ? "text-brand-blue" : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {title}
                </span>
                {locked ? <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default HeaderAndTab;

