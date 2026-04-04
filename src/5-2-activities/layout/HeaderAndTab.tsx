import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, Calendar, Users } from "lucide-react";
import { cn } from "@/shared/lib/utils";

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
    title: "Client Visits",
    icon: Users,
  },
];

export const HeaderAndTab = () => {
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
            
            return (
              <div
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "group flex cursor-pointer items-center gap-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
                  isActive
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
                  {tab.title}
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default HeaderAndTab;

