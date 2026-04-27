import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";

type TabConfig = {
  id: string;
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function HeaderAndTab() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs: TabConfig[] = [
    {
      id: "traffic",
      label: "Web Traffic",
      icon: BarChart3,
      route: "/digital-marketing/traffic",
    },
  ];

  const activeTabId = location.pathname.startsWith("/digital-marketing/traffic")
    ? "traffic"
    : "traffic";

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">Web Traffic</h1>
        <p className="text-xs text-gray-600">Monitor traffic & campaign performance</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => navigate(tab.route)}
                className={`flex items-center space-x-1.5 py-1.5 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "TrafficHeaderAndTab";

