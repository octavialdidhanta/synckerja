import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppHeader } from "@/shared/layouts/header/AppHeader";
import { AppSidebar } from "@/shared/layouts/sidebar/AppSidebar";
import { useHeaderUserProfile } from "@/shared/hooks/useHeaderUserProfile";
import { usePreferredLocaleSync } from "@/shared/hooks/usePreferredLocaleSync";

export function AppShellLayout() {
  const { t } = useTranslation();
  const { user } = useHeaderUserProfile();
  usePreferredLocaleSync(user?.id);

  return (
    <SidebarProvider
      className="flex h-full min-h-0 w-full flex-col"
      defaultOpen={false}
      sidebarToggleLabel={t("layout.header.toggleSidebar")}
      mobileNavSheetTitle={t("layout.a11y.mobileNavTitle")}
      mobileNavSheetDescription={t("layout.a11y.mobileNavDescription")}
    >
      <AppHeader />
      <div className="mt-16 flex min-h-0 min-w-0 flex-1">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* flex + flex-1 child: fills scrollport so pages don’t leave a bottom “strip” when using h-full/% */}
            {/* min-w-0: lets wide child pages (e.g. employees table min-width) shrink so inner overflow-x-auto works instead of clipping under overflow-x-hidden */}
            <div className="scrollbar-hide seamless-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
              <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
