import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, Receipt, DollarSign, CreditCard } from "lucide-react";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";

interface HeaderAndTabProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const HeaderAndTab = ({ onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    {
      id: "purchase",
      label: "Purchase",
      icon: ShoppingCart,
      route: "/request-form/purchase",
    },
    {
      id: "reimbursement",
      label: "Reimbursement",
      icon: Receipt,
      route: "/request-form/reimbursement",
    },
    {
      id: "cash-advance",
      label: "Cash Advance",
      icon: DollarSign,
      route: "/request-form/cash-advance",
    },
    {
      id: "loan",
      label: "Loan",
      icon: CreditCard,
      route: "/request-form/loan",
    },
  ];

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    if (tab.route) {
      navigate(tab.route);
    } else {
      onTabChange?.(tab.id);
    }
  };

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes("/reimbursement")) return "reimbursement";
    if (path.includes("/cash-advance")) return "cash-advance";
    if (path.includes("/loan")) return "loan";
    if (path.includes("/purchase")) return "purchase";
    return "purchase";
  };

  const activeTabId = getActiveTab();

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">Request Form</h1>
        <p className="text-xs text-muted-foreground">
          Submit and manage purchase requests, reimbursements, and financial requests
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1" role="tablist">
          {tabs.map((tab) => (
            <ModuleTabNavItem
              key={tab.id}
              pagePath={tab.route}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTabId === tab.id}
              onActivate={() => handleTabClick(tab)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
