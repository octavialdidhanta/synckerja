import { useNavigate, useLocation } from "react-router-dom";
import { FileText } from "lucide-react";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const PAGE_ACCESS_ROUTE = "/access-permissions/page-access";

export const HeaderAndTab = ({ activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive =
    location.pathname === PAGE_ACCESS_ROUTE || activeTab === "page-access";

  const handleActivate = () => {
    navigate(PAGE_ACCESS_ROUTE);
    onTabChange("page-access");
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">Access Permissions</h1>
        <p className="text-xs text-muted-foreground">Manage user access, roles, and page-level permissions</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={PAGE_ACCESS_ROUTE}
            label="Page Access"
            icon={FileText}
            isActive={isActive}
            onActivate={handleActivate}
            activeClassName="border-brand-blue text-brand-blue"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
