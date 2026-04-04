import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageCircle, Instagram, Mail, Inbox } from "lucide-react";

const tabs = [
  {
    key: "dashboard",
    path: "/operations/consultant/dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "leads-management",
    path: "/operations/consultant/leads-management",
    title: "Leads Management",
    icon: Users,
  },
  {
    key: "whatsapp-connect",
    path: "/operations/consultant/whatsapp/connect",
    title: "Connect WhatsApp",
    icon: MessageCircle,
  },
  {
    key: "instagram-connect",
    path: "/operations/consultant/instagram/connect",
    title: "Connect Instagram",
    icon: Instagram,
  },
  {
    key: "email-connect",
    path: "/operations/consultant/email/connect",
    title: "Connect Email",
    icon: Mail,
  },
  {
    key: "livechat",
    path: "/operations/consultant/all/livechat",
    title: "Live Chat",
    icon: Inbox,
  },
];

export const HeaderAndTab = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = useMemo(() => {
    if (location.pathname === "/operations/consultant/leads-management") return "leads-management";
    if (location.pathname.startsWith("/operations/consultant/whatsapp/connect")) return "whatsapp-connect";
    if (location.pathname.startsWith("/operations/consultant/instagram/connect")) return "instagram-connect";
    if (location.pathname.startsWith("/operations/consultant/email/connect")) return "email-connect";
    if (location.pathname.startsWith("/operations/consultant/all/livechat")) return "livechat";
    const match = tabs.find((tab) => location.pathname.startsWith(tab.path));
    return match?.key ?? "leads-management";
  }, [location.pathname]);

  return (
    <div className="min-w-0 max-w-full px-1 py-3">
      {/* Header Section */}
      <div className="mb-3 min-w-0">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">CRM</h1>
        <p className="text-xs text-gray-600">Manage leads and sales consultant activities</p>
      </div>

      {/* Tabs Section */}
      <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
        <nav className="flex min-w-0 flex-nowrap gap-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;
            
            return (
              <div
                key={tab.key}
                onClick={() => navigate(tab.path)}
                className={`flex items-center space-x-1.5 py-1.5 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-surface-border"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.title}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default HeaderAndTab;

