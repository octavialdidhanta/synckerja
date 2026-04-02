import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, Receipt, DollarSign, CreditCard } from "lucide-react";

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
      description: "Submit purchase requests for items and services",
      route: "/request-form/purchase",
    },
    {
      id: "reimbursement",
      label: "Reimbursement",
      icon: Receipt,
      description: "Request reimbursement for expenses",
      route: "/request-form/reimbursement",
    },
    {
      id: "cash-advance",
      label: "Cash Advance",
      icon: DollarSign,
      description: "Request cash advance for business needs",
      route: "/request-form/cash-advance",
    },
    {
      id: "loan",
      label: "Loan",
      icon: CreditCard,
      description: "Request loans and financial assistance",
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

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">Request Form</h1>
        <p className="text-xs text-muted-foreground">
          Submit and manage purchase requests, reimbursements, and financial requests
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={`flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";
