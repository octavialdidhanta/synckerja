import { useEffect, useMemo, useTransition } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeaderAndTab } from "../section/HeaderAndTab";
import KOLManagementPage from "../components/KOLManagementPage";
import { EnhancedKOLDashboard } from "../components/EnhancedKOLDashboard";
import KOLCampaignsPage from "../components/KOLCampaignsPage";
import { ContentPostPage } from "@/6-2-2-content-post";
import { PaymentTermsPage } from "@/6-2-3-payment-terms";

const KolManagementDashboardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [, startTransition] = useTransition();

  const activeTab = useMemo(() => {
    const pathname = location.pathname;
    if (pathname === "/kol-management/dashboard" || pathname === "/kol-management") return "dashboard";
    if (pathname === "/kol-management/kol-management") return "kol-management";
    if (pathname === "/kol-management/campaigns") return "campaigns";
    if (pathname === "/kol-management/content-post") return "content-post";
    if (pathname === "/kol-management/payment-terms") return "payment-terms";
    return "dashboard";
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/kol-management") {
      startTransition(() => {
        navigate("/kol-management/dashboard", { replace: true });
      });
    }
  }, [location.pathname, navigate, startTransition]);

  useEffect(() => {
    if (location.pathname === "/kol-management/analytics") {
      startTransition(() => {
        navigate("/kol-management/dashboard", { replace: true });
      });
    }
  }, [location.pathname, navigate, startTransition]);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col px-4 pb-2">
            <div className="flex min-h-full flex-1 flex-col">
              <div className="mb-1 flex-shrink-0">
                <HeaderAndTab activeTab={activeTab} />
              </div>

              <div className="flex-1 min-h-0 min-w-0 overflow-x-hidden">
                {activeTab === "dashboard" ? (
                  <EnhancedKOLDashboard />
                ) : activeTab === "kol-management" ? (
                  <KOLManagementPage />
                ) : activeTab === "campaigns" ? (
                  <KOLCampaignsPage />
                ) : activeTab === "content-post" ? (
                  <ContentPostPage />
                ) : activeTab === "payment-terms" ? (
                  <PaymentTermsPage />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    {activeTab}
                  </div>
                )}
              </div>
            </div>

            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KolManagementDashboardPage;

